'use client';

import { useState, useMemo } from 'react';

interface SliderConfig {
  key: string; label: string; min: number; max: number; step: number;
  value: number; unit: string; hint?: string; scoreDir: 'pos' | 'neg';
}

function Slider({ cfg, onChange }: { cfg: SliderConfig; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[11px] text-[#c8d8f0]">{cfg.label}</label>
        <span className="text-[11px] font-mono font-bold text-[#00d4ff]">{cfg.value}{cfg.unit}</span>
      </div>
      {cfg.hint && <p className="text-[9px] text-[#4a6080]">{cfg.hint}</p>}
      <input type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={cfg.value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#00d4ff' }} />
      <div className="flex justify-between text-[9px] font-mono text-[#2a3d5a]">
        <span>{cfg.min}{cfg.unit}</span><span>{cfg.max}{cfg.unit}</span>
      </div>
    </div>
  );
}

function scoreColor(s: number) { return s >= 75 ? '#00ff88' : s >= 50 ? '#ffb800' : '#ff4466'; }
function scoreLabel(s: number) { return s >= 75 ? '긍정적' : s >= 50 ? '중립' : '부정적'; }
function signalLight(s: number) {
  if (s >= 75) return { icon: '🟢', label: '강매수', color: '#00ff88' };
  if (s >= 50) return { icon: '🟡', label: '중립',   color: '#ffb800' };
  return             { icon: '🔴', label: '관망',   color: '#ff4466' };
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  return (
    <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
      <p className="text-[10px] text-[#4a6080] font-mono mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-mono font-bold" style={{ color }}>{score}</span>
        <div className="flex-1">
          <div className="h-2 bg-[#1e2d4a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${score}%`, backgroundColor: color }} />
          </div>
          <p className="text-[9px] font-mono mt-0.5" style={{ color }}>{scoreLabel(score)}</p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ step, title, open, onToggle }: { step: number; title: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0f1628] transition-colors rounded-lg">
      <span className="text-[10px] font-mono text-[#4a6080] w-14 shrink-0">STEP {step}</span>
      <span className="text-sm font-bold text-[#e8f0ff] flex-1">{title}</span>
      <span className="text-[#4a6080] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
    </button>
  );
}

const TOP5_REGIONS = [
  { rank: 1, name: '서울 강동구 (고덕·둔촌)', color: '#00ff88',
    logic: '둔촌주공 입주 완료로 신축 프리미엄 확립. 9호선 연장·한강변 개발 기대.',
    risk: '단기 입주 물량 과다. 전세가 하락 압력 잔존.',
    upProb: 68, range: '+10~20%', type: '장기보유' },
  { rank: 2, name: '경기 화성시 (동탄2)', color: '#00d4ff',
    logic: 'GTX-A 개통 직접 수혜. 삼성전자 반도체 클러스터 인접.',
    risk: 'GTX 지연 리스크. 외곽 특성상 유동성 부족.',
    upProb: 62, range: '+8~18%', type: '실거주' },
  { rank: 3, name: '서울 마포구 (아현·공덕)', color: '#b48eff',
    logic: '도심 직주근접 최우수. 재개발 본격화. 트리플 역세권.',
    risk: '이미 고평가 구간 진입. 재개발 조합 갈등 리스크.',
    upProb: 58, range: '+5~15%', type: '갭투자' },
  { rank: 4, name: '인천 연수구 (송도)', color: '#ffb800',
    logic: '바이오 클러스터 기업 유치 가속. GTX-B 노선 확정.',
    risk: '공급 과잉 이력. 서울 접근성 약점.',
    upProb: 55, range: '+6~14%', type: '장기보유' },
  { rank: 5, name: '경기 과천시', color: '#ff9944',
    logic: '공공기관 이전 효과. 과천 지식정보타운 개발. 학군 수요 안정.',
    risk: '절대 가격 고점 부담. 공급 물량 예정 다수.',
    upProb: 52, range: '+4~12%', type: '실거주' },
];

const CORRELATIONS = [
  { asset: '코스피',         corr1y: 0.42,  corr3y: 0.38,  desc: '동반 상승 경향. 경기 회복기 동조화 강화.' },
  { asset: 'S&P 500',        corr1y: 0.28,  corr3y: 0.31,  desc: '간접 연동. 달러 강세 시 역상관 전환.' },
  { asset: '달러/원 환율',   corr1y: -0.51, corr3y: -0.44, desc: '원화 약세 시 외국인 자금 이탈로 부동산 약세.' },
  { asset: '미국 10년 국채', corr1y: -0.63, corr3y: -0.58, desc: '금리 상승 시 가장 직접적 하락 압력.' },
  { asset: '금',             corr1y: 0.19,  corr3y: 0.22,  desc: '약한 양의 상관. 인플레 헤지 자산 동반.' },
];

const INIT_MACRO: SliderConfig[] = [
  { key: 'rate',      label: '한국 기준금리',      min: 0.5, max: 5.0, step: 0.25, value: 3.0, unit: '%',    scoreDir: 'neg', hint: '낮을수록 부동산 친화적' },
  { key: 'mortgageR', label: '주담대 금리',         min: 2.0, max: 8.0, step: 0.1,  value: 4.2, unit: '%',    scoreDir: 'neg', hint: '현재 시중은행 평균' },
  { key: 'dsr',       label: 'DSR 규제 강도',       min: 1,   max: 5,   step: 1,    value: 3,   unit: '단계', scoreDir: 'neg', hint: '1=완화 5=강화' },
  { key: 'm2',        label: 'M2 증가율',           min: -2,  max: 15,  step: 0.5,  value: 5.0, unit: '%',    scoreDir: 'pos', hint: '유동성 공급 지표' },
  { key: 'houseLoan', label: '주담대 증가율(YoY)',  min: -5,  max: 20,  step: 0.5,  value: 6.0, unit: '%',    scoreDir: 'pos', hint: '높을수록 수요 강함' },
];

const INIT_SUPPLY: SliderConfig[] = [
  { key: 'seoulTx',  label: '서울 거래량 변화율',  min: -50, max: 100, step: 5, value: 10, unit: '%',    scoreDir: 'pos', hint: '6개월 전 대비' },
  { key: 'unsold',   label: '전국 미분양 물량',    min: 0,   max: 100, step: 1, value: 55, unit: '천호', scoreDir: 'neg', hint: '7만호 이상 위험' },
  { key: 'supply3y', label: '3년 입주 예정 물량',  min: 0,   max: 50,  step: 1, value: 28, unit: '만호', scoreDir: 'neg', hint: '30만호 이상 과잉' },
  { key: 'jeonseR',  label: '서울 전세가율',       min: 30,  max: 80,  step: 1, value: 52, unit: '%',    scoreDir: 'pos', hint: '높을수록 수요 강함' },
  { key: 'txSpeed',  label: '거래량 회복 속도',    min: 1,   max: 5,   step: 1, value: 3,  unit: '단계', scoreDir: 'pos', hint: '1=침체 5=급회복' },
];

export function AIInsightPanel() {
  const [openStep, setOpenStep] = useState<number>(1);
  const [macro, setMacro]       = useState<SliderConfig[]>(INIT_MACRO);
  const [supply, setSupply]     = useState<SliderConfig[]>(INIT_SUPPLY);
  const [complex, setComplex]   = useState({ name: '', directWork: 5, school: 5, transport: 5, redev: 3, supplyRisk: 3 });

  const toggleStep = (n: number) => setOpenStep(p => p === n ? 0 : n);
  const upd = (list: SliderConfig[], set: (v: SliderConfig[]) => void, key: string, val: number) =>
    set(list.map(s => s.key === key ? { ...s, value: val } : s));

  const macroScore = useMemo(() => {
    const scores = macro.map(s => {
      const pct = (s.value - s.min) / (s.max - s.min);
      return s.scoreDir === 'pos' ? pct * 100 : (1 - pct) * 100;
    });
    return Math.round(scores.reduce((a, b) => a + b) / scores.length);
  }, [macro]);

  const supplyScore = useMemo(() => {
    const scores = supply.map(s => {
      const pct = (s.value - s.min) / (s.max - s.min);
      return s.scoreDir === 'pos' ? pct * 100 : (1 - pct) * 100;
    });
    return Math.round(scores.reduce((a, b) => a + b) / scores.length);
  }, [supply]);

  const rateScore    = Math.round((1 - (macro[0].value - 0.5) / 4.5) * 100);
  const txScore      = Math.round(Math.max(0, Math.min(100, 50 + supply[0].value)));
  const jeonseScore  = Math.round(((supply[3].value - 30) / 50) * 100);
  const supplyRScore = Math.round((1 - supply[2].value / 50) * 100);
  const liquidityScore = Math.round((rateScore + txScore + jeonseScore + supplyRScore) / 4);
  const totalScore = Math.round(macroScore * 0.4 + supplyScore * 0.4 + liquidityScore * 0.2);

  const cycleStages = useMemo(() => {
    const s = totalScore;
    if (s >= 75) return [{ label: '과열 단계', prob: 25 }, { label: '확산 국면', prob: 45 }, { label: '반등 초기', prob: 20 }, { label: '침체 후반', prob: 7 }, { label: '침체 초기', prob: 3 }];
    if (s >= 60) return [{ label: '확산 국면', prob: 35 }, { label: '반등 초기', prob: 35 }, { label: '과열 단계', prob: 15 }, { label: '침체 후반', prob: 10 }, { label: '침체 초기', prob: 5 }];
    if (s >= 45) return [{ label: '반등 초기', prob: 40 }, { label: '침체 후반', prob: 30 }, { label: '확산 국면', prob: 20 }, { label: '침체 초기', prob: 8 }, { label: '과열 단계', prob: 2 }];
    return [{ label: '침체 후반', prob: 45 }, { label: '침체 초기', prob: 30 }, { label: '반등 초기', prob: 15 }, { label: '확산 국면', prob: 8 }, { label: '과열 단계', prob: 2 }];
  }, [totalScore]);

  const strategy = useMemo(() => {
    if (totalScore >= 72) return { label: '공격적 매수', prob: 70, color: '#00ff88', desc: '금리 환경 개선 + 거래량 회복 + 수급 균형. 적극 매수 구간 진입.' };
    if (totalScore >= 58) return { label: '분할 매수',   prob: 60, color: '#00d4ff', desc: '긍정 지표 우세하나 리스크 잔존. 3~6개월 분할 진입 권장.' };
    if (totalScore >= 44) return { label: '관망',        prob: 55, color: '#ffb800', desc: '방향성 불확실. 거래량 회복 신호 확인 후 진입 검토.' };
    return { label: '매도/비중 축소', prob: 65, color: '#ff4466', desc: '유동성 긴축 + 수급 악화. 리스크 자산 비중 축소 권장.' };
  }, [totalScore]);

  const complexScore = Math.round(
    complex.directWork * 10 * 0.25 + complex.school * 10 * 0.20 +
    complex.transport * 10 * 0.25 + (6 - complex.supplyRisk) * 10 * 0.15 +
    complex.redev * 10 * 0.15
  );
  const complexLabel = complexScore >= 70 ? '저평가 가능성' : complexScore >= 50 ? '적정 가격' : '고평가 주의';
  const complexLabelColor = scoreColor(complexScore);
  const signal = signalLight(liquidityScore);

  return (
    <div className="space-y-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-[#e8f0ff]">🏠 한국 부동산 분석</h2>
          <p className="text-[10px] text-[#4a6080] font-mono mt-0.5">8단계 거시 유동성 기반 스코어링 · 슬라이더로 지표 직접 조정</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl border"
          style={{ borderColor: `${signal.color}50`, backgroundColor: `${signal.color}10` }}>
          <span className="text-2xl">{signal.icon}</span>
          <div>
            <p className="text-xs font-bold font-mono" style={{ color: signal.color }}>{signal.label}</p>
            <p className="text-[10px] font-mono text-[#4a6080]">종합 {totalScore}점</p>
          </div>
        </div>
      </div>

      {/* STEP 1 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={1} title="거시 환경 분석" open={openStep === 1} onToggle={() => toggleStep(1)} />
        {openStep === 1 && (
          <div className="px-4 pb-4 space-y-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 grid md:grid-cols-2 gap-4">
              {macro.map(s => <Slider key={s.key} cfg={s} onChange={v => upd(macro, setMacro, s.key, v)} />)}
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <ScoreGauge score={macroScore} label="유동성 환경 점수" />
              <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] col-span-2">
                <p className="text-[10px] text-[#4a6080] font-mono mb-2">판별 결과</p>
                <p className="text-sm font-bold" style={{ color: scoreColor(macroScore) }}>
                  {macroScore >= 65 ? '🟢 부동산 친화적' : macroScore >= 45 ? '🟡 중립' : '🔴 긴축적'}
                </p>
                <p className="text-[11px] text-[#4a6080] mt-1">
                  {macroScore >= 65 ? '금리 인하 사이클 + 유동성 공급 확대. 매수 여건 양호.'
                    : macroScore >= 45 ? '금리 방향성 불확실. 관망 또는 선별 접근 권장.'
                    : '고금리 지속 + 유동성 긴축. 수요 위축 구간.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={2} title="부동산 수급 분석" open={openStep === 2} onToggle={() => toggleStep(2)} />
        {openStep === 2 && (
          <div className="px-4 pb-4 space-y-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 grid md:grid-cols-2 gap-4">
              {supply.map(s => <Slider key={s.key} cfg={s} onChange={v => upd(supply, setSupply, s.key, v)} />)}
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <ScoreGauge score={supplyScore} label="수급 밸런스 점수" />
              <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] col-span-2">
                <p className="text-[10px] text-[#4a6080] font-mono mb-2">판별 결과</p>
                <p className="text-sm font-bold" style={{ color: scoreColor(supplyScore) }}>
                  {supplyScore >= 65 ? '🟢 공급 부족' : supplyScore >= 45 ? '🟡 균형' : '🔴 공급 과잉'}
                </p>
                <p className="text-[11px] text-[#4a6080] mt-1">
                  미분양 {supply[1].value}천호 / 3년 입주 {supply[2].value}만호 / 전세가율 {supply[3].value}% / 거래량 {supply[0].value > 0 ? '+' : ''}{supply[0].value}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={3} title="부동산 사이클 단계 판별" open={openStep === 3} onToggle={() => toggleStep(3)} />
        {openStep === 3 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-2">
              {cycleStages.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-[#4a6080] w-20 shrink-0">{s.label}</span>
                  <div className="flex-1 h-5 bg-[#1e2d4a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                      style={{ width: `${s.prob}%`, backgroundColor: i === 0 ? scoreColor(totalScore) : '#2a3d5a' }}>
                      <span className="text-[9px] font-mono font-bold text-white">{s.prob}%</span>
                    </div>
                  </div>
                  {i === 0 && <span className="text-[10px] font-mono font-bold shrink-0" style={{ color: scoreColor(totalScore) }}>← 최유력</span>}
                </div>
              ))}
              <p className="text-[10px] text-[#4a6080] pt-2">※ 거시({macroScore}점) + 수급({supplyScore}점) 종합 기반 확률 산출</p>
            </div>
          </div>
        )}
      </div>

      {/* STEP 4 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={4} title="뜨는 지역 TOP 5" open={openStep === 4} onToggle={() => toggleStep(4)} />
        {openStep === 4 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-3">
              {TOP5_REGIONS.map(r => (
                <div key={r.rank} className="p-4 rounded-xl border"
                  style={{ borderColor: `${r.color}40`, backgroundColor: `${r.color}08` }}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono font-bold" style={{ color: r.color }}>#{r.rank}</span>
                      <span className="text-sm font-bold text-[#e8f0ff]">{r.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono font-bold" style={{ color: r.color }}>{r.upProb}% 상승확률</p>
                      <p className="text-[10px] font-mono text-[#4a6080]">{r.range} / 3년</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-[#0a0e1a] border border-[#1e2d4a]">
                      <p className="text-[9px] font-mono text-[#00ff88] mb-1">▲ 상승 논리</p>
                      <p className="text-[11px] text-[#c8d8f0]">{r.logic}</p>
                    </div>
                    <div className="p-2 rounded bg-[#0a0e1a] border border-[#1e2d4a]">
                      <p className="text-[9px] font-mono text-[#ff4466] mb-1">▼ 리스크</p>
                      <p className="text-[11px] text-[#c8d8f0]">{r.risk}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                      style={{ color: r.color, backgroundColor: `${r.color}18`, border: `1px solid ${r.color}30` }}>
                      {r.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 5 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={5} title="단지 단위 정밀 분석" open={openStep === 5} onToggle={() => toggleStep(5)} />
        {openStep === 5 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-4">
              <div>
                <label className="text-[10px] text-[#4a6080] font-mono">분석할 단지명</label>
                <input type="text" placeholder="예: 래미안 원베일리, 둔촌주공 등"
                  value={complex.name}
                  onChange={e => setComplex(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded bg-[#0a0e1a] border border-[#1e2d4a] text-[12px] font-mono text-[#c8d8f0] placeholder-[#2a3d5a]"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { key: 'directWork', label: '직주근접 점수',    hint: '도심 접근성' },
                  { key: 'school',     label: '학군 점수',        hint: '명문 학교 근접' },
                  { key: 'transport',  label: '교통 점수',        hint: '역세권·버스노선' },
                  { key: 'redev',      label: '재건축 기대감',    hint: '1=없음 10=확실' },
                  { key: 'supplyRisk', label: '주변 공급 리스크', hint: '1=없음 10=매우 많음 (낮을수록 좋음)' },
                ].map(f => (
                  <Slider key={f.key}
                    cfg={{ key: f.key, label: f.label, min: 1, max: 10, step: 1,
                      value: complex[f.key as keyof typeof complex] as number,
                      unit: '점', scoreDir: f.key === 'supplyRisk' ? 'neg' : 'pos', hint: f.hint }}
                    onChange={v => setComplex(p => ({ ...p, [f.key]: v }))}
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a] col-span-2">
                  <p className="text-[10px] font-mono text-[#4a6080] mb-2">{complex.name || '단지명 입력 후 분석'}</p>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl font-mono font-bold" style={{ color: complexLabelColor }}>{complexScore}점</span>
                    <span className="text-sm font-bold" style={{ color: complexLabelColor }}>{complexLabel}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-[#0f1628]">
                      <p className="text-[9px] text-[#4a6080]">3년 상승 확률</p>
                      <p className="text-sm font-mono font-bold text-[#00ff88]">{Math.round(30 + complexScore * 0.4)}%</p>
                    </div>
                    <div className="p-2 rounded bg-[#0f1628]">
                      <p className="text-[9px] text-[#4a6080]">하락 리스크</p>
                      <p className="text-sm font-mono font-bold text-[#ff4466]">{Math.round(60 - complexScore * 0.4)}%</p>
                    </div>
                  </div>
                </div>
                <ScoreGauge score={complexScore} label="단지 종합 점수" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 6 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={6} title="부동산 유동성 스코어" open={openStep === 6} onToggle={() => toggleStep(6)} />
        {openStep === 6 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ScoreGauge score={rateScore}    label="금리 환경" />
                <ScoreGauge score={txScore}      label="거래량" />
                <ScoreGauge score={jeonseScore}  label="전세가율" />
                <ScoreGauge score={supplyRScore} label="공급 리스크" />
              </div>
              <div className="p-5 rounded-xl border-2 text-center transition-all"
                style={{ borderColor: signal.color, backgroundColor: `${signal.color}10` }}>
                <p className="text-5xl mb-2">{signal.icon}</p>
                <p className="text-2xl font-mono font-bold" style={{ color: signal.color }}>종합 {liquidityScore}점</p>
                <p className="text-lg font-bold mt-1" style={{ color: signal.color }}>{signal.label}</p>
                <p className="text-[11px] text-[#4a6080] mt-2">
                  {liquidityScore >= 75 ? '모든 지표 긍정적. 적극 매수 타이밍.'
                    : liquidityScore >= 50 ? '혼재 신호. 분할 매수 또는 관망.'
                    : '다수 지표 부정적. 진입 시기 재검토 필요.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 7 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={7} title="자산 순환 연결 분석" open={openStep === 7} onToggle={() => toggleStep(7)} />
        {openStep === 7 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-2">
              {CORRELATIONS.map(c => {
                const col = c.corr1y > 0 ? '#00ff88' : '#ff4466';
                return (
                  <div key={c.asset} className="p-3 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#e8f0ff]">{c.asset}</span>
                      <div className="flex gap-3">
                        <span className="text-[10px] font-mono" style={{ color: col }}>1년 {c.corr1y > 0 ? '+' : ''}{Math.round(c.corr1y * 100)}%</span>
                        <span className="text-[10px] font-mono text-[#4a6080]">3년 {c.corr3y > 0 ? '+' : ''}{Math.round(c.corr3y * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[#4a6080]">{c.desc}</p>
                  </div>
                );
              })}
              <div className="p-3 rounded-lg bg-[#b48eff12] border border-[#b48eff30] mt-2">
                <p className="text-[10px] font-mono text-[#b48eff] mb-1">📊 금리 민감도</p>
                <p className="text-[11px] text-[#c8d8f0]">기준금리 1%p 하락 시 서울 아파트 평균 +4~8% 반응 (12~18개월 후행)</p>
                <p className="text-[11px] text-[#c8d8f0] mt-1">
                  현재 자산순환 상 부동산이 다음 주자가 될 확률:&nbsp;
                  <span className="font-bold" style={{ color: scoreColor(totalScore) }}>{Math.round(30 + totalScore * 0.45)}%</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STEP 8 */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <SectionHeader step={8} title="최종 전략 제안" open={openStep === 8} onToggle={() => toggleStep(8)} />
        {openStep === 8 && (
          <div className="px-4 pb-4 animate-fadeIn border-t border-[#1e2d4a]">
            <div className="pt-4 space-y-4">
              <div className="p-5 rounded-xl border-2 text-center"
                style={{ borderColor: strategy.color, backgroundColor: `${strategy.color}10` }}>
                <p className="text-3xl font-mono font-bold mb-1" style={{ color: strategy.color }}>{strategy.label}</p>
                <p className="text-lg font-mono text-[#4a6080]">확률 {strategy.prob}%</p>
              </div>
              <div className="p-4 rounded-lg bg-[#0a0e1a] border border-[#1e2d4a]">
                <p className="text-[11px] text-[#c8d8f0] leading-relaxed">{strategy.desc}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreGauge score={macroScore}     label="거시 환경" />
                <ScoreGauge score={supplyScore}    label="수급 밸런스" />
                <ScoreGauge score={liquidityScore} label="유동성 종합" />
              </div>
              <p className="text-[10px] text-[#2a3d5a] text-center font-mono">
                ⚠ 본 분석은 참고용이며 투자 권유가 아닙니다. 실제 투자 시 전문가 상담 필수.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
