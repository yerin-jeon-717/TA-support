import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Database, RefreshCw, FileUp, Target, Send, Loader2, 
  Sparkles, AlertCircle, Search, X, FileText, UploadCloud, ChevronDown, Gem,
  MessageSquare, Coffee, ShieldCheck
} from 'lucide-react';

const SHEET_ID = "1BU0YaVCsn6taWyUZcQK5GtBpwQE2v8g_Cm7vXJuViwo";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const App = () => {
  // --- 상태 관리 ---
  const [sessionType, setSessionType] = useState('1st_interview'); // teatime, 1st_interview, 2nd_interview
  const [positions, setPositions] = useState([]);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  
  const [jdInput, setJdInput] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [firstRoundFeedback, setFirstRoundFeedback] = useState(''); // 2차 면접 전용 선택 사항
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBsttxX1PxzB5X0FPSkZbKXMPccK3hpfwk"; 

  // --- CSV 파싱 및 정제 ---
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

    const headers = lines[0].map(h => h.replace(/["']/g, '').trim());
    return lines.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ? row[i].replace(/^"|"$/g, '').trim() : '';
      });
      return obj;
    });
  };

  const fetchJDDatabase = async () => {
    setSyncing(true);
    try {
      const response = await fetch(SHEET_CSV_URL);
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      setPositions(parsedData);
      setFilteredPositions(parsedData);
    } catch (err) { setError("데이터 동기화 실패"); }
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

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsDropdownOpen(true);
    const filtered = positions.filter(p => {
      const posName = p['포지션명'] || Object.values(p)[1] || '';
      return posName.toLowerCase().includes(term.toLowerCase());
    });
    setFilteredPositions(filtered);
  };

  const selectPosition = (pos) => {
    const name = pos['포지션명'] || Object.values(pos)[1];
    const jd = pos['JD 내용'] || pos['JD'] || Object.values(pos)[2];
    setSelectedPosition(pos);
    setSearchTerm(name);
    setJdInput(jd || '');
    setIsDropdownOpen(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) setUploadedFile(file);
  };

  const handleGenerate = async () => {
    if (!jdInput) { setError('포지션을 먼저 선택해 주세요.'); return; }
    setLoading(true);
    setError(null);
    try {
      const systemPrompt = `당신은 15년 차 TA 팀장입니다. 세션 타입(${sessionType})에 맞춰 JD와 이력서를 분석하여 질문 20개를 생성하세요. JSON { "questions": [{"no":1, "group":"역량", "content":"질문", "intent":"의도"}] } 로만 응답하세요.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `세션:${sessionType}\nJD:${jdInput}\n이력서:${resumeText}\n배경:${additionalContext}\n1차피드백:${firstRoundFeedback}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const result = await res.json();
      const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
      setQuestions(parsed.questions || []);
    } catch (err) { setError("질문 생성 중 오류가 발생했습니다."); }
    finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    const text = "번호\t카테고리\t질문 내용\t의도\n" + questions.map(q => `${q.no}\t${q.group}\t${q.content}\t${q.intent}`).join('\n');
    navigator.clipboard.writeText(text).then(() => alert("클립보드에 복사되었습니다."));
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-10 py-6 flex justify-between items-center shrink-0 z-[60] shadow-sm">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 p-3 rounded-[20px]"><Users className="text-white w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">Interview Supporter</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">AI-Powered Recruiting Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* 세션 타입 선택기 */}
          <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
            <button onClick={() => setSessionType('teatime')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${sessionType === 'teatime' ? 'bg-white text-orange-500 shadow-md' : 'text-slate-500'}`}>
              <Coffee className="w-3.5 h-3.5" /> 티타임
            </button>
            <button onClick={() => setSessionType('1st_interview')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${sessionType === '1st_interview' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> 1차 면접
            </button>
            <button onClick={() => setSessionType('2nd_interview')} className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${sessionType === '2nd_interview' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-500'}`}>
              <Sparkles className="w-3.5 h-3.5" /> 2차 면접
            </button>
          </div>
          <button onClick={fetchJDDatabase} className={`p-3 rounded-2xl border hover:bg-slate-50 ${syncing ? 'animate-spin' : ''}`}>
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Input Panel */}
        <div className="w-[480px] bg-white border-r border-slate-200 p-10 overflow-y-auto space-y-10 shadow-inner custom-scrollbar">
          
          {/* Step 1. JD Selection */}
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" /> Step 1. 포지션 JD 선택</label>
            <div className="relative" ref={dropdownRef}>
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" className="w-full pl-12 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-[24px] text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="포지션명 검색..." value={searchTerm} onChange={handleSearch} onFocus={() => setIsDropdownOpen(true)} />
              {isDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-[24px] shadow-2xl z-[100] max-h-64 overflow-y-auto py-2">
                  {filteredPositions.map((pos, idx) => (
                    <button key={idx} onClick={() => selectPosition(pos)} className="w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center justify-between group border-b border-slate-50 last:border-0">
                      <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600">{pos['포지션명'] || Object.values(pos)[1]}</span>
                      <span className="text-[10px] text-slate-300 font-mono">{pos['공고 ID'] || Object.values(pos)[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {jdInput && <textarea className="w-full h-40 p-6 bg-slate-900 text-indigo-100 rounded-[28px] text-[11px] font-mono outline-none resize-none leading-relaxed shadow-2xl" value={jdInput} readOnly />}
          </div>

          {/* Step 2. Resume Summary */}
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileUp className="w-4 h-4 text-indigo-500" /> Step 2. 후보자 이력서 요약</label>
            <div className="relative border-2 border-dashed border-slate-200 rounded-[28px] p-8 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
              {uploadedFile ? (
                <div className="text-center">
                  <FileText className="text-indigo-600 w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm font-black text-slate-700">{uploadedFile.name}</p>
                </div>
              ) : (
                <><UploadCloud className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm font-bold text-slate-500">이력서 파일 업로드</p></>
              )}
            </div>
            <textarea className="w-full h-32 p-6 bg-white border border-slate-200 rounded-[28px] text-sm shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10" placeholder="후보자의 주요 성과나 특징을 요약해 주세요." value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          </div>

          {/* Step 3. Additional Context & Feedback (Conditional) */}
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare className="w-4 h-4 text-indigo-500" /> Step 3. 추가 설명</label>
            <div className="space-y-4">
              {/* 2차 면접 세션일 때만 나타나는 선택 입력창 */}
              {sessionType === '2nd_interview' && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-2 ml-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[11px] font-bold text-amber-600 uppercase">1차 면접 피드백 (선택 사항)</span>
                  </div>
                  <textarea 
                    className="w-full h-28 p-5 bg-amber-50/50 border border-amber-100 rounded-[24px] text-xs font-medium outline-none shadow-sm placeholder:text-amber-300" 
                    placeholder="1차 면접에서의 주요 피드백이나 검증이 필요한 지점을 입력하세요." 
                    value={firstRoundFeedback} 
                    onChange={(e) => setFirstRoundFeedback(e.target.value)} 
                  />
                </div>
              )}
              <textarea className="w-full h-28 p-5 bg-white border border-slate-200 rounded-[24px] text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm" placeholder="기타 참고사항 (채용 우선순위, 팀 상황 등)" value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} />
            </div>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-600 rounded-[20px] text-xs font-bold border border-red-100 flex items-center gap-3"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

          <button onClick={handleGenerate} disabled={loading || syncing} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-base shadow-2xl flex items-center justify-center gap-4 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />} {loading ? "분석 중..." : "Generate Interview Guide"}
          </button>
        </div>

        {/* Right Side: Result Panel */}
        <div className="flex-1 p-12 overflow-y-auto bg-[#F1F5F9] custom-scrollbar">
          {questions.length > 0 ? (
            <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-32">
              <div className="flex justify-between items-end mb-10">
                <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic">Selection Guide</h2>
                <button onClick={copyToClipboard} className="px-10 py-5 bg-white border-2 border-slate-900 rounded-[30px] text-sm font-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all">전체 복사</button>
              </div>
              <div className="bg-white rounded-[48px] shadow-2xl border border-white overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-10 py-7 text-center w-20">No</th>
                      <th className="px-10 py-7 w-48">Validation</th>
                      <th className="px-10 py-7">Question</th>
                      <th className="px-10 py-7 w-64 text-right">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {questions.map((q) => (
                      <tr key={q.no} className="hover:bg-indigo-50/50 transition-all group">
                        <td className="px-10 py-8 text-slate-300 font-black text-center group-hover:text-indigo-500">{q.no}</td>
                        <td className="px-10 py-8"><span className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase group-hover:bg-indigo-600 group-hover:text-white transition-all">{q.group}</span></td>
                        <td className="px-10 py-8 font-bold text-[17px] text-slate-800 leading-snug tracking-tight">{q.content}</td>
                        <td className="px-10 py-8 text-right italic text-[11px] text-slate-400 font-bold leading-tight">{q.intent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-8">
              <div className="w-64 h-64 bg-white rounded-[72px] shadow-2xl flex items-center justify-center border border-white animate-bounce duration-[4000ms]">
                <Target className="w-24 h-24 text-indigo-500" />
              </div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Ready to Deep Scan</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;