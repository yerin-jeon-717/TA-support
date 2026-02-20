import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Database, 
  RefreshCw, 
  FileUp, 
  Target, 
  Send, 
  Loader2, 
  CheckCircle2, 
  Clipboard, 
  MessageSquare, 
  Gem, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

// --- 구글 시트 설정 ---
const SHEET_ID = "1BU0YaVCsn6taWyUZcQK5GtBpwQE2v8g_Cm7vXJuViwo";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const App = () => {
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
  
  // Vercel 환경변수 또는 직접 입력
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || "AIzaSyBsttxX1PxzB5X0FPSkZbKXMPccK3hpfwk"; 

  const LEADERSHIP_PRINCIPLES = `
    1. Design the Future: 미래를 긍정적으로 그리고 오늘의 문제를 치열하게 해결.
    2. Customer Obsession: 고객 관점에서 문제를 정의하고 해결책 구축.
    3. Dive Deep: 디테일에 집착하며 사안을 끝까지 고민.
    4. Sense the Market: 트렌드를 놓치지 않고 기회를 발견.
    5. Built to Be the Best: 최고의 기준을 세우고 타협하지 않음.
    6. Always Be Growing: 개인과 회사의 연결된 성장.
    7. Ownership: 전사적 관점과 책임감.
    8. Constructive Teamwork: 솔직한 소통과 결정 후 일치된 방향성.
    9. Act with Urgency: 문제 인식 시 주저 없는 실행.
    10. Deliver Results: 결과로 증명하는 책임감.
  `;

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
    const headers = lines[0];
    return lines.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
  };

  const fetchJDDatabase = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("시트 연동 실패");
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      setPositions(parsedData);
    } catch (err) { setError("백엔드 시트 동기화 실패"); }
    finally { setSyncing(false); }
  };

  useEffect(() => { fetchJDDatabase(); }, []);

  const handlePositionSelect = (e) => {
    const id = e.target.value;
    setSelectedPositionId(id);
    const pos = positions.find(p => p['공고 ID'] === id);
    if (pos) setJdInput(pos['JD'] || '');
    else setJdInput('');
  };

  const handleGenerate = async () => {
    if (!jdInput) { setError('포지션을 먼저 선택해주세요.'); return; }
    if (!apiKey) { setError('API Key가 없습니다.'); return; }
    setLoading(true);
    setError(null);
    try {
      const systemPrompt = `당신은 15년 차 TA 팀장입니다. 뷰티셀렉션 JD와 LP를 분석하여 질문 20개를 생성하세요. JSON { "questions": [...] } 로만 응답하세요.`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `세션:${sessionType}\nJD:${jdInput}\n후보자:${resumeText}\nLP:${LEADERSHIP_PRINCIPLES}\n추가맥락:${additionalContext}\n1차피드백:${firstRoundFeedback}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const result = await res.json();
      const parsed = JSON.parse(result.candidates[0].content.parts[0].text);
      setQuestions(parsed.questions || []);
    } catch (err) { setError("생성 실패"); }
    finally { setLoading(false); }
  };

  const copyToClipboard = () => {
    const text = "번호\t카테고리\t질문 내용\t의도\n" + questions.map(q => `${q.no}\t${q.group}\t${q.content}\t${q.intent}`).join('\n');
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert("복사되었습니다!");
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-10 py-6 flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 p-3 rounded-[20px] shadow-2xl ring-4 ring-slate-50">
            <Users className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none mb-1">Interview Supporter</h1>
            <p className="text-[11px] text-indigo-600 font-bold uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Beauty Selection TA Lead Edition
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
            {['teatime', '1st_interview', '2nd_interview'].map((t) => (
              <button key={t} onClick={() => setSessionType(t)} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${sessionType === t ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500'}`}>
                {t === 'teatime' ? '티타임' : t === '1st_interview' ? '1차' : '2차'}
              </button>
            ))}
          </div>
          <button onClick={fetchJDDatabase} className={`p-3 rounded-2xl border ${syncing ? 'animate-spin' : ''}`}><RefreshCw className="w-5 h-5 text-slate-400" /></button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex overflow-hidden">
        <div className="w-[480px] bg-white border-r border-slate-200 p-10 overflow-y-auto space-y-10 scrollbar-hide shadow-inner">
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Database className="w-4 h-4 text-indigo-500" /> Step 1. 포지션 데이터</label>
            <select className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[24px] text-sm font-black text-slate-700 outline-none" value={selectedPositionId} onChange={handlePositionSelect}>
              <option value="">백엔드 시트의 공고를 선택하세요</option>
              {positions.map((pos, idx) => <option key={idx} value={pos['공고 ID']}>{pos['포지션명']}</option>)}
            </select>
            {jdInput && <textarea className="w-full h-48 p-6 bg-slate-900 text-indigo-100 rounded-[28px] text-[11px] font-mono outline-none resize-none leading-relaxed" value={jdInput} readOnly />}
          </div>
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileUp className="w-4 h-4 text-indigo-500" /> Step 2. 후보자 경험 요약</label>
            <textarea className="w-full h-44 p-6 bg-white border border-slate-200 rounded-[28px] text-sm shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="성과 위주로 요약..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
          </div>
          <div className="space-y-5">
            <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" /> Step 3. 추가 전략</label>
            {sessionType === '2nd_interview' && <textarea className="w-full h-28 p-5 bg-amber-50 border border-amber-100 rounded-[24px] text-xs outline-none" placeholder="1차 피드백..." value={firstRoundFeedback} onChange={(e) => setFirstRoundFeedback(e.target.value)} />}
            <textarea className="w-full h-28 p-5 bg-white border border-slate-200 rounded-[24px] text-sm outline-none" placeholder="추가 고려사항..." value={additionalContext} onChange={(e) => setAdditionalContext(e.target.value)} />
          </div>
          {error && <div className="p-5 bg-red-50 text-red-600 rounded-[24px] text-[11px] font-bold border border-red-100">{error}</div>}
          <button onClick={handleGenerate} disabled={loading || syncing} className="w-full bg-slate-900 text-white py-6 rounded-[32px] font-black text-base shadow-2xl transition-all flex items-center justify-center gap-4">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />} {loading ? "디자인 중..." : "Generate Interview Guide"}
          </button>
        </div>

        <div className="flex-1 p-12 overflow-y-auto bg-[#F1F5F9] scrollbar-hide relative">
          {questions.length > 0 ? (
            <div className="max-w-5xl mx-auto animate-in fade-in duration-700 pb-32">
              <div className="flex justify-between items-end mb-14">
                <h2 className="text-6xl font-black text-slate-900 tracking-tighter">Lead's Tactical<br/><span className="text-indigo-600 italic">Interview Guide</span></h2>
                <button onClick={copyToClipboard} className="px-10 py-5 bg-white border-2 border-slate-900 rounded-[30px] text-sm font-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all">표 전체 복사</button>
              </div>
              <div className="bg-white rounded-[64px] shadow-2xl border border-white overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-12 py-8 text-[11px] font-black uppercase w-24 text-center">No</th>
                      <th className="px-12 py-8 text-[11px] font-black uppercase w-56 text-indigo-400">Validation</th>
                      <th className="px-12 py-8 text-[11px] font-black uppercase">Question</th>
                      <th className="px-12 py-8 text-[11px] font-black uppercase w-72 text-right text-slate-500">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {questions.map((q) => (
                      <tr key={q.no} className="hover:bg-indigo-50/30 transition-all group">
                        <td className="px-12 py-10 text-base text-slate-300 font-black text-center group-hover:text-indigo-500">{q.no}</td>
                        <td className="px-12 py-10"><span className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm uppercase">{q.group}</span></td>
                        <td className="px-12 py-10"><p className="text-[19px] font-bold text-slate-800 leading-snug group-hover:text-indigo-950 transition-colors mb-2 tracking-tight">{q.content}</p></td>
                        <td className="px-12 py-10 text-right italic text-[11px] text-slate-400 font-bold leading-tight">{q.intent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-1000">
              <div className="w-64 h-64 bg-white rounded-[72px] shadow-2xl flex items-center justify-center border border-white animate-bounce duration-[5000ms]">
                <Target className="w-28 h-28 text-indigo-500" />
              </div>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">Ready to Design Strategy</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;