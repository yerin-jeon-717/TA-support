import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Database, RefreshCw, FileUp, Target, Send, Loader2, 
  Sparkles, AlertCircle, Search, X, FileText, UploadCloud, ChevronDown, Gem
} from 'lucide-react';

// --- 구글 시트 설정 ---
const SHEET_ID = "1BU0YaVCsn6taWyUZcQK5GtBpwQE2v8g_Cm7vXJuViwo";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const App = () => {
  const [sessionType, setSessionType] = useState('1st_interview');
  const [positions, setPositions] = useState([]);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  
  const [jdInput, setJdInput] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [firstRoundFeedback, setFirstRoundFeedback] = useState('');
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBsttxX1PxzB5X0FPSkZbKXMPccK3hpfwk"; 

  // --- CSV 파싱 및 키값 정제 로직 ---
  const parseCSV = (csvText) => {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      if (inQuotes) {
        if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
        else if (char === '"') inQuotes = false;
        else currentField += char;
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { currentLine.push(currentField.trim()); currentField = ''; }
        else if (char === '\n' || char === '\r') {
          if (char === '\r' && nextChar === '\n') i++;
          currentLine.push(currentField.trim());
          lines.push(currentLine);
          currentLine = [];
          currentField = '';
        } else currentField += char;
      }
    }
    if (currentField || currentLine.length > 0) { currentLine.push(currentField.trim()); lines.push(currentLine); }
    if (lines.length < 1) return [];

    const headers = lines[0].map(h => h.replace(/["']/g, '').trim()); // 헤더 따옴표 및 공백 제거
    
    return lines.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        // 데이터 필드의 따옴표 제거 및 매핑
        const value = row[i] ? row[i].replace(/^"|"$/g, '').trim() : '';
        obj[h] = value;
      });
      return obj;
    });
  };

  const fetchJDDatabase = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("시트 접근 실패");
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      console.log("정제된 데이터 샘플:", parsedData[0]); // 콘솔에서 키값 확인용
      
      setPositions(parsedData);
      setFilteredPositions(parsedData);
    } catch (err) { 
      setError("데이터 동기화 실패: 시트 공유 설정(링크가 있는 모든 사용자에게 뷰어)을 확인하세요."); 
    }
    finally { setSyncing(false); }
  };

  useEffect(() => { 
    fetchJDDatabase(); 
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- 검색 및 선택 로직 (유연한 키 매칭) ---
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsDropdownOpen(true);
    
    const filtered = positions.filter(p => {
      // '포지션명' 키가 없더라도 첫 번째 혹은 두 번째 밸류에서 검색 시도
      const posName = p['포지션명'] || Object.values(p)[1] || '';
      return posName.toLowerCase().includes(term.toLowerCase());
    });
    setFilteredPositions(filtered);
  };

  const selectPosition = (pos) => {
    const name = pos['포지션명'] || Object.values(pos)[1];
    const jd = pos['JD 내용'] || pos['JD'] || Object.values(pos)[2]; // Apps Script에서 설정한 'JD 내용' 우선
    
    setSelectedPosition(pos);
    setSearchTerm(name);
    setJdInput(jd || '내용 없음');
    setIsDropdownOpen(false);
  };

  // --- 질문 생성 로직 ---
  const handleGenerate = async () => {
    if (!jdInput || jdInput === '내용 없음') { setError('포지션을 선택하거나 JD를 확인해 주세요.'); return; }
    setLoading(true);
    setError(null);
    try {
      const systemPrompt = `당신은 15년 차 TA 팀장입니다. JD와 후보자 정보를 분석하여 JSON { "questions": [{"no":1, "group":"역량", "content":"질문", "intent":"의도"}] } 로 응답하세요.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `세션:${sessionType}\nJD:${jdInput}\n이력서:${resumeText}\n피드백:${firstRoundFeedback}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const result = await res.json();
      const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
      setQuestions(parsed.questions || []);
    } catch (err) { setError("질문 생성 실패: API 키 또는 네트워크를 확인하세요."); }
    finally { setLoading(false); }
  };

  // ... (나머지 Copy logic 등은 동일)

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* Header (생략 - 기존과 동일) */}
      <header className="bg-white border-b border-slate-200 px-10 py-6 flex justify-between items-center shrink-0 z-[60]">
        <div className="flex items-center gap-5">
            <div className="bg-slate-900 p-3 rounded-[20px]"><Users className="text-white w-7 h-7" /></div>
            <h1 className="text-2xl font-black tracking-tighter">Interview Supporter</h1>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={fetchJDDatabase} className={`p-3 rounded-2xl border ${syncing ? 'animate-spin' : ''}`}>
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Side */}
        <div className="w-[480px] bg-white border-r border-slate-200 p-10 overflow-y-auto space-y-10 shadow-inner">
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4" /> Step 1. 포지션 JD 선택</label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative z-50">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  className="w-full pl-12 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-[24px] text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="포지션명 검색..."
                  value={searchTerm}
                  onChange={handleSearch}
                  onFocus={() => setIsDropdownOpen(true)}
                />
              </div>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-[24px] shadow-2xl z-[100] max-h-64 overflow-y-auto py-2">
                  {filteredPositions.length > 0 ? (
                    filteredPositions.map((pos, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => selectPosition(pos)}
                        className="w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center justify-between group border-b border-slate-50 last:border-0"
                      >
                        <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600">
                          {pos['포지션명'] || Object.values(pos)[1] || '포지션명 없음'}
                        </span>
                        <span className="text-[10px] text-slate-300 font-mono">
                          {pos['공고 ID'] || Object.values(pos)[0]}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-6 py-8 text-center text-slate-400 text-xs italic">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
            {jdInput && (
              <div className="relative animate-in slide-in-from-top-4">
                <textarea className="w-full h-40 p-6 bg-slate-900 text-indigo-100 rounded-[28px] text-[11px] font-mono outline-none resize-none leading-relaxed shadow-2xl" value={jdInput} readOnly />
                <div className="absolute top-4 right-4"><Gem className="w-4 h-4 text-indigo-400/30" /></div>
              </div>
            )}
          </div>
          
          {/* Step 2, 3 및 Generate 버튼 부분 (기존과 동일하므로 유지) */}
          <button onClick={handleGenerate} disabled={loading || syncing} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-base shadow-2xl flex items-center justify-center gap-4 hover:bg-black active:scale-[0.98] disabled:opacity-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />} {loading ? "분석 중..." : "Generate Interview Guide"}
          </button>
        </div>

        {/* Right Side (질문 출력 테이블 - 기존과 동일) */}
        <div className="flex-1 p-12 overflow-y-auto bg-[#F1F5F9]">
            {/* 결과 출력 로직 생략 (기존 코드 유지) */}
            {questions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center space-y-12">
                     <div className="w-64 h-64 bg-white rounded-[72px] shadow-2xl flex items-center justify-center border border-white">
                        <Target className="w-28 h-28 text-indigo-500" />
                     </div>
                     <h3 className="text-5xl font-black text-slate-900 tracking-tighter">Ready to Deep Scan</h3>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default App;