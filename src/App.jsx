import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Coffee, 
  FileText, 
  Clipboard, 
  PlusCircle, 
  AlertCircle,
  Send,
  Loader2,
  CheckCircle2,
  Upload,
  X,
  Database,
  RefreshCw,
  Gem,
  MessageSquare,
  FileUp,
  Target,
  Sparkles
} from 'lucide-react';

/**
 * [설정 안내]
 * 1. SHEET_ID: 데이터가 담긴 구글 시트의 ID입니다.
 * 2. apiKey: Gemini API 키를 입력해야 정상 작동합니다.
 */
const SHEET_ID = "1BU0YaVCsn6taWyUZcQK5GtBpwQE2v8g_Cm7vXJuViwo";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const App = () => {
  // --- 상태 관리 (State) ---
  const [sessionType, setSessionType] = useState('1st_interview');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [jdInput, setJdInput] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [firstRoundFeedback, setFirstRoundFeedback] = useState('');
  const [positions, setPositions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  
  // Gemini API Key (⚠️ 실제 사용 시 본인의 키를 입력하세요)
  const apiKey = "AIzaSyBsttxX1PxzB5X0FPSkZbKXMPccK3hpfwk"; 

  // --- 뷰티셀렉션 리더십 원칙 (Leadership Principles) ---
  const LEADERSHIP_PRINCIPLES = `
    1. Design the Future: 미래를 긍정적으로 그리고 오늘의 문제를 치열하게 해결합니다.
    2. Customer Obsession: 고객의 관점에서 문제를 정의하고 해결책을 만듭니다.
    3. Dive Deep: 디테일에 집착하며 사안을 끝까지 고민합니다.
    4. Sense the Market: 트렌드를 놓치지 않고 기회를 발견합니다.
    5. Built to Be the Best: 최고의 기준을 세우고 타협하지 않습니다.
    6. Always Be Growing: 개인과 회사의 연결된 성장에 집착합니다.
    7. Company-wide Perspective & Ownership: 전사적 관점과 책임감을 가집니다.
    8. Constructive Teamwork: 솔직하게 소통하고 한 방향으로 힘을 모읍니다.
    9. Act with Urgency: 문제를 인식하면 주저하지 않고 실행합니다.
    10. Deliver Results: 마지막까지 책임지고 결과를 만들어냅니다.
  `;

  // --- CSV 데이터 파싱 유틸리티 ---
  const parseCSV = (csvText) => {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"'; i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') {
          currentLine.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && nextChar === '\n') i++;
          currentLine.push(currentField.trim());
          lines.push(currentLine);
          currentLine = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      lines.push(currentLine);
    }
    if (lines.length < 1) return [];
    const headers = lines[0];
    return lines.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
  };

  // --- 백엔드 시트 데이터 동기화 ---
  const fetchJDDatabase = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("시트 데이터를 가져올 수 없습니다. 공유 설정을 확인하세요.");
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      setPositions(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchJDDatabase();
  }, []);

  const handlePositionSelect = (e) => {
    const id = e.target.value;
    setSelectedPositionId(id);
    const pos = positions.find(p => p['공고 ID'] === id);
    if (pos) setJdInput(pos['JD'] || '');
    else setJdInput('');
  };

  // --- 인터뷰 질문 생성 로직 (Gemini API) ---
  const handleGenerate = async () => {
    if (!jdInput) { setError('포지션을 먼저 선택해 주세요.'); return; }
    if (!apiKey) { setError('Gemini API Key를 입력해 주세요.'); return; }
    setLoading(true);
    setError(null);

    const systemPrompt = `
      당신은 15년 차 Talent Acquisition 팀장입니다. 
      뷰티셀렉션의 💎 다이아몬드 헤더 기반 JD와 아래 리더십 원칙(LP)을 분석하여 날카로운 인터뷰 질문 20개를 생성하세요.
      
      [LP 기반 검증 항목]
      ${LEADERSHIP_PRINCIPLES}
      
      [JD 헤더 분석 지침]
      - 부서 소개: "💎합류하게 될 부서를 소개해요"
      - 업무 내용: "💎합류하시면 이런 일들을 함께해요"
      - 자격 조건: "💎이런 분을 찾고 있어요"
      - 우대 조건: "💎이런 경험이 있다면 더 좋아요"
      
      [결과 포맷]
      반드시 JSON 객체 내 "questions" 배열(no, group, content, intent)로 응답하세요.
    `;

    const userQuery = `
      세션 종류: ${sessionType}
      JD 정보: ${jdInput}
      후보자 이력서 요약: ${resumeText || '미입력'}
      추가 컨텍스트: ${additionalContext}
      1차 면접 피드백(필요 시): ${firstRoundFeedback}
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const result = await res.json();
      const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
      setQuestions(parsed.questions || []);
    } catch (err) {
      setError("질문을 생성하는 도중 오류가 발생했습니다. API 키를 다시 확인해 보세요.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = "번호\t카테고리\t질문 내용\t의도\n" + questions.map(q => `${q.no}\t${q.group}\t${q.content}\t${q.intent}`).join('\n');
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("복사되었습니다! 스프레드시트에 바로 붙여넣으세요.");
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-2.5 rounded-2xl shadow-lg">
            <Users className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter">Interview Supporter</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Beauty Selection TA Lead Edition
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
            {['teatime', '1st_interview', '2nd_interview'].map(t => (
              <button key={t} onClick={() => setSessionType(t)} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${sessionType === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                {t === 'teatime' ? '티타임' : t === '1st_interview' ? '1차' : '2차'}
              </button>
            ))}
          </div>
          <button onClick={fetchJDDatabase} className={`p-2.5 rounded-xl border border-slate-200 ${syncing ? 'animate-spin' : ''}`}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'text-indigo-600' : 'text-slate-400'}`} />
          </button>
        </div>
      </header>

      {/* 메인 레이아웃 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 왼쪽 설정 패널 */}
        <div className="w-[450px] bg-white border-r border-slate-200 p-8 overflow-y-auto space-y-8 scrollbar-hide shadow-inner">
          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" /> Step 1. 포지션 선택</label>
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" value={selectedPositionId} onChange={handlePositionSelect}>
              <option value="">공고를 선택하세요 (시트 연동됨)</option>
              {positions.map((pos, idx) => <option key={idx} value={pos['공고 ID']}>{pos['포지션명']}</option>)}
            </select>
            {jdInput && <textarea className="w-full h-40 p-5 bg-slate-900 text-indigo-100 rounded-[24px] text-[11px] font-mono outline-none resize-none leading-relaxed overflow-y-auto" value={jdInput} readOnly />}
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileUp className="w-4 h-4 text-indigo-500" /> Step 2. 후보자 성과 요약</label>
            <textarea className="w-full h-40 p-5 bg-white border border-slate-200 rounded-[24px] text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="이력서의 핵심 경력과 성과를 입력하세요." value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" /> Step 3. 추가 전략</label>
            {sessionType === '2nd_interview' && <textarea className="w-full h-24 p-4 bg-amber-50 border border-amber-100 rounded-[20px] text-xs outline-none shadow-sm" placeholder="1차 면접 피드백을 입력하세요..." value={firstRoundFeedback} onChange={(e) => setFirstRoundFeedback(e.target.value)} />}
            <textarea className="w-full h-24 p-4 bg-white border border-slate-200 rounded-[20px] text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="최우선 평가 기준, 팀 상황 등을 입력하세요." value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} />
          </div>

          {error && <div className="p-4 bg-red-50 text-red-600 rounded-[20px] text-[11px] font-bold border border-red-100 shadow-sm">{error}</div>}

          <button onClick={handleGenerate} disabled={loading || syncing} className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black text-sm shadow-2xl active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-3">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} {loading ? "설계 중..." : "Generate Interview Guide"}
          </button>
        </div>

        {/* 오른쪽 결과 화면 */}
        <div className="flex-1 p-10 overflow-y-auto bg-[#F1F5F9] scrollbar-hide relative">
          {questions.length > 0 ? (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-700 pb-20">
              <div className="flex justify-between items-end mb-12">
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">TA Guide</h2>
                <button onClick={copyToClipboard} className="px-8 py-4 bg-white border-2 border-slate-900 rounded-[24px] text-sm font-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all">표 복사하기</button>
              </div>
              <div className="bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-10 py-7 text-[10px] font-black uppercase tracking-widest w-20 text-center">No</th>
                      <th className="px-10 py-7 text-[10px] font-black uppercase tracking-widest w-48 text-indigo-400 font-black">Validation</th>
                      <th className="px-10 py-7 text-[10px] font-black uppercase tracking-widest">Interview Question</th>
                      <th className="px-10 py-7 text-[10px] font-black uppercase tracking-widest w-64 text-right text-slate-400">Intent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions.map((q) => (
                      <tr key={q.no} className="hover:bg-indigo-50/40 group transition-colors">
                        <td className="px-10 py-8 text-sm text-slate-300 font-black text-center">{q.no}</td>
                        <td className="px-10 py-8"><span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">{q.group}</span></td>
                        <td className="px-10 py-8 font-bold text-[17px] text-slate-800 leading-snug group-hover:text-indigo-900">{q.content}</td>
                        <td className="px-10 py-8 text-right font-medium italic text-[11px] text-slate-400 leading-tight">{q.intent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-10">
              <div className="w-56 h-56 bg-white rounded-[64px] shadow-2xl flex items-center justify-center animate-bounce duration-[4000ms]"><Target className="w-24 h-24 text-indigo-500" /></div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Ready to Design</h3>
              <p className="text-slate-400 font-bold max-w-sm text-center">백엔드 시트의 JD 데이터와 뷰티셀렉션 LP를 기반으로 질문을 생성합니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;