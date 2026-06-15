import React, { useEffect, useState, useRef } from 'react';
import { getSmartAssistantResponse, type UserContext } from '../../engines/assistant.engine';
import { useDataLink } from '../../core/data-link';
import { UCUM_MAP } from '../../core/constants';

interface GlossaryTerm {
  term: string;
  abbr: string;
  definition: string;
  units: string;
}

const GLOSSARY: GlossaryTerm[] = [
  { term: 'RIR (Повторения в запасе)', abbr: 'RIR', definition: '', units: 'шкала 0-10' },
  { term: '', abbr: 'Hct', definition: '', units: '%' },
  { term: 'EC50', abbr: 'EC50', definition: '', units: '' },
  { term: 'BMR (Базовый метаболизм)', abbr: 'BMR', definition: '', units: '' },
  { term: 'TDEE (Общий расход энергии)', abbr: 'TDEE', definition: '', units: '' },
  { term: 'HOMA-IR', abbr: 'HOMA-IR', definition: '', units: 'условные единицы' },
  { term: 'HGI (Индекс гомеостаза/иммунитета)', abbr: 'HGI', definition: '', units: 'условные единицы' },
  { term: 'MRR (Минимальный диапазон рисков)', abbr: 'MRR', definition: '', units: 'условные единицы' },
  { term: '', abbr: '', definition: '', units: '' },
  { term: '', abbr: '', definition: '', units: '' },
  { term: '', abbr: 'Free T', definition: '', units: '' },
  { term: 'eGFR', abbr: 'eGFR', definition: '', units: '' },
  { term: '', abbr: '', definition: '', units: '' },
  { term: '', abbr: '', definition: '', units: '' },
  { term: '', abbr: 'Ferritin', definition: '', units: '' },
];

interface CheckupQuestion {
  label: string;
  key: string;
  min: number;
  max: number;
}

const CHECKUP_QUESTIONS: CheckupQuestion[] = [
  { label: 'Сон (1-10)', key: 'sleep', min: 1, max: 10 },
  { label: 'Стресс (1-10)', key: 'stress', min: 1, max: 10 },
  { label: 'Крепатура (1-10)', key: 'doms', min: 1, max: 10 },
  { label: 'Либидо (0-10)', key: 'libido', min: 0, max: 10 },
  { label: 'Самочувствие (1-10)', key: 'wellbeing', min: 1, max: 10 },
];

export const SmartAssistantScreen: React.FC = () => {
  const linked = useDataLink();
  const [messages, setMessages] = useState<{id: number; text: string; isUser: boolean}[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const [checkupOpen, setCheckupOpen] = useState(false);
  const [checkupValues, setCheckupValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    CHECKUP_QUESTIONS.forEach(q => { init[q.key] = q.min; });
    return init;
  });
  const [checkupSubmitted, setCheckupSubmitted] = useState(false);

  useEffect(() => {
    setMessages([{
      id: 1,
      text: '',
      isUser: false
    }]);
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: input,
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const ctx: UserContext = {
        risks: linked.risk ? { overall: linked.risk.overallRaw, systems: linked.risk.systemBreakdown ? Object.fromEntries(Object.entries(linked.risk.systemBreakdown).map(([k, v]: [string, any]) => [k, v.raw])) : undefined } : undefined,
        readiness: linked.readiness ? { recovery: linked.readiness.recovery, fatigue: linked.readiness.fatigue, nutrition: linked.readiness.nutrition } : undefined,
        courseSubstances: linked.course?.map(c => c.substanceId),
        labAlerts: linked.labs ? linked.labs.filter(l => {
          const ref = UCUM_MAP[l.code.toUpperCase()];
          return ref && (l.value > ref.uln || l.value < ref.lln);
        }).map(l => ({ marker: l.code.toUpperCase(), status: l.value > (UCUM_MAP[l.code.toUpperCase()]?.uln ?? 9999) ? 'high' : 'low' })) : undefined,
        goal: linked.profile?.settings?.goal ?? linked.profile?.settings?.primaryGoal,
      };
      const response = await getSmartAssistantResponse(input, ctx);
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: response.text,
        isUser: false
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: '',
        isUser: false
      }]);
    } finally {
      setLoading(false);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const submitCheckup = () => {
    const sleep = checkupValues.sleep;
    const stress = checkupValues.stress;
    const doms = checkupValues.doms;
    const libido = checkupValues.libido;
    const wellbeing = checkupValues.wellbeing;

    const recovery = Math.round(((sleep + (10 - stress) + (10 - doms) + libido + wellbeing) / 50) * 100);
    const fatigue = Math.round(100 - recovery);

    setCheckupSubmitted(true);

    const summaryMsg = {
      id: Date.now(),
      text: ``,
      isUser: false
    };

    setMessages(prev => [...prev, summaryMsg]);
  };

  const resetCheckup = () => {
    const init: Record<string, number> = {};
    CHECKUP_QUESTIONS.forEach(q => { init[q.key] = q.min; });
    setCheckupValues(init);
    setCheckupSubmitted(false);
    setCheckupOpen(false);
  };

  const filteredGlossary = GLOSSARY.filter(g =>
    g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    g.abbr.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    g.definition.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  if (loading && messages.length === 1) {
    return <div className="screen assistant">Загрузка умного ассистента...</div>;
  }

  return (
    <div className="screen assistant">
      <div className="assistant-header">
        <h2>Умный ассистент</h2>
        <p>Чекапы и глоссарий</p>
      </div>
      
      <div className="messages-container" ref={messagesEndRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.isUser ? 'user' : 'assistant'}`}>
            <div className="message-content">{msg.text}</div>
          </div>
        ))}
        {loading && <div className="message loading-message">Ассистент думает...</div>}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder=""
          className="assistant-input"
          disabled={loading}
        />
        <button 
          onClick={sendMessage} 
          disabled={loading || !input.trim()}
          className="send-btn"
        >
          {loading ? '' : ''}
        </button>
      </div>
      
      <div className="assistant-footer">
        <div className="quick-actions">
          <button className="quick-action" onClick={() => setCheckupOpen(true)}>📋 Чекап недели</button>
          <button className="quick-action" onClick={() => { setGlossaryOpen(true); setGlossarySearch(''); setExpandedTerm(null); }}>📖 Глоссарий</button>
          <button className="quick-action" onClick={() => {
            const rdy = linked.readiness;
            if (!rdy) { setMessages(m => [...m, { id: Date.now(), text: '⚠️ Данные о готовности ещё не загружены. Заполните профиль и анализы.', isUser: false }]); return; }
            setMessages(m => [...m, { id: Date.now(), text: ``, isUser: false }]);
          }}>🔔 Напоминания</button>
          <button className="quick-action" onClick={() => {
            const quickQuestions = [
              '',
              '',
              '',
              '',
              '',
            ];
            const q = quickQuestions[Math.floor(Math.random() * quickQuestions.length)];
            setInput(q);
          }}>💡 Быстрый вопрос</button>
        </div>
      </div>
      

      {glossaryOpen && (
        <div className="modal-overlay" onClick={() => setGlossaryOpen(false)}>
          <div className="modal glossary-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📖 Глоссарий терминов</h3>
              <button className="modal-close" onClick={() => setGlossaryOpen(false)}>✕</button>
            </div>
            <input
              type="text"
              className="glossary-search"
              placeholder=""
              value={glossarySearch}
              onChange={e => { setGlossarySearch(e.target.value); setExpandedTerm(null); }}
              autoFocus
            />
            <div className="glossary-list">
              {filteredGlossary.length === 0 && (
                <div className="glossary-empty">Термины не найдены</div>
              )}
              {filteredGlossary.map(g => (
                <div
                  key={g.abbr}
                  className={`glossary-item ${expandedTerm === g.abbr ? 'expanded' : ''}`}
                  onClick={() => setExpandedTerm(expandedTerm === g.abbr ? null : g.abbr)}
                >
                  <div className="glossary-term-row">
                    <span className="glossary-term-name">{g.term}</span>
                    {g.units && <span className="glossary-term-units">{g.units}</span>}
                  </div>
                  {expandedTerm === g.abbr && (
                    <div className="glossary-term-definition">{g.definition}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {checkupOpen && (
        <div className="modal-overlay" onClick={() => resetCheckup()}>
          <div className="modal checkup-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Чекап недели</h3>
              <button className="modal-close" onClick={() => resetCheckup()}>✕</button>
            </div>
            {!checkupSubmitted ? (
              <>
                {CHECKUP_QUESTIONS.map(q => (
                  <div key={q.key} className="checkup-question">
                    <div className="checkup-label">
                      <span>{q.label}</span>
                      <span className="checkup-value">{checkupValues[q.key]}</span>
                    </div>
                    <input
                      type="range"
                      min={q.min}
                      max={q.max}
                      value={checkupValues[q.key]}
                      onChange={e => setCheckupValues(prev => ({ ...prev, [q.key]: parseFloat(e.target.value) || 0 }))}
                      className="checkup-slider"
                    />
                    <div className="checkup-range-labels">
                      <span>{q.min}</span>
                      <span>{q.max}</span>
                    </div>
                  </div>
                ))}
                <button className="checkup-submit-btn" onClick={submitCheckup}>
                  Отправить чекап
                </button>
              </>
            ) : (
              <div className="checkup-result">
                <p>✅ Чекап отправлен! Результаты добавлены в чат.</p>
                <button className="checkup-submit-btn" onClick={resetCheckup}>
                  Закрыть
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};