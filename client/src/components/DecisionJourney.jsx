function latestResult(toolCalls, name) {
  return [...toolCalls].reverse().find((call) => call.name === name)?.result;
}

function Step({ index, title, status, evidence, compact }) {
  const done = status === 'done';
  const active = status === 'active';
  const tone = done
    ? 'border-emerald-300/30 bg-emerald-400/10'
    : active
      ? 'border-amber-300/30 bg-amber-300/10'
      : 'border-slate-700/60 bg-slate-950/20';
  const badge = done
    ? 'bg-emerald-400 text-slate-950'
    : active
      ? 'bg-amber-300 text-slate-950'
      : 'bg-slate-700 text-slate-300';

  return (
    <div className={`relative rounded-2xl border ${tone} ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge}`}>
          {done ? '✓' : index}
        </span>
        <div className="min-w-0">
          <div className={`font-semibold ${compact ? 'text-sm text-slate-800' : 'text-sm text-white'}`}>{title}</div>
          <div className={`mt-1 text-xs leading-5 ${compact ? 'text-slate-600' : 'text-slate-300'}`}>{evidence}</div>
        </div>
      </div>
    </div>
  );
}

export default function DecisionJourney({ messages = [], toolCalls = [], compact = false }) {
  if (!toolCalls.length) return null;

  const latestUserPrompt = [...messages].reverse().find((message) => (
    message.role === 'user'
    && !/(^|[，。,.!\s])(yes|no|确认|同意|暂不执行|稍后提醒)([，。,.!\s]|$)/i.test(message.content || '')
  ))?.content;
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  const vehicle = latestResult(toolCalls, 'get_vehicle_status');
  const assessmentResult = latestResult(toolCalls, 'assess_trip_energy');
  const assessment = typeof assessmentResult?.sufficient === 'boolean' ? assessmentResult : null;
  const stationsResult = latestResult(toolCalls, 'search_nearby_stations');
  const stations = (Array.isArray(stationsResult) ? stationsResult : stationsResult?.stations || [])
    .filter((station) => station.availablePorts === undefined || station.availablePorts > 0)
    .slice(0, 2);
  const plan = latestResult(toolCalls, 'create_charge_plan');
  const decision = latestAssistant?.decision;

  const assessmentEvidence = assessment
    ? `${assessment.roundTrip ? '往返' : '单程'} ${assessment.tripDistance_km}km + 安全余量 ${assessment.reserveRange_km}km；需 ${assessment.requiredRange_km}km，${assessment.sufficient ? '当前可覆盖' : `仍缺 ${assessment.shortage_km}km`}`
    : assessmentResult?.error
      ? '缺少可信路线距离，Agent 已停止估算并向用户追问。'
      : '等待路线距离与能耗评估。';

  const optionEvidence = stations.length
    ? stations.map((station, index) => `${index === 0 ? '主' : '备'}：${station.name} · ${station.distance_km}km · ${station.maxPower_kW}kW`).join('；')
    : '等待检索可用站点并比较距离、功率、空位与偏好。';

  const confirmationEvidence = plan?.status === 'pending'
    ? `已创建任务 ${plan.id || ''}，保留后续提醒与执行证据。`
    : decision?.requiresConfirmation
      ? '方案已生成，等待用户 Yes / No；确认前不会写入任务或执行导航。'
      : '等待形成可确认方案。';

  const steps = [
    { title: '理解任务', status: latestUserPrompt ? 'done' : 'active', evidence: latestUserPrompt || '等待用户任务。' },
    { title: '读取车辆状态', status: vehicle ? 'done' : 'active', evidence: vehicle ? `SOC ${vehicle.soc}% · 可用续航 ${vehicle.estimatedRange_km}km` : '调用车辆状态工具。' },
    { title: '计算行程能耗', status: assessment || assessmentResult?.error ? 'done' : 'active', evidence: assessmentEvidence },
    { title: '比较补能方案', status: stations.length ? 'done' : 'active', evidence: optionEvidence },
    { title: '确认并创建任务', status: plan?.status === 'pending' ? 'done' : decision?.requiresConfirmation ? 'active' : 'pending', evidence: confirmationEvidence },
  ];

  return (
    <section className={`rounded-3xl border border-cyan-300/20 ${compact ? 'bg-white p-3' : 'bg-slate-900/75 p-5 shadow-2xl backdrop-blur'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${compact ? 'text-cyan-600' : 'text-cyan-300'}`}>Decision Journey</div>
          <h3 className={`mt-1 font-semibold ${compact ? 'text-slate-800' : 'text-white'}`}>一次完整决策是怎样形成的</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] ${compact ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-300/10 text-cyan-100'}`}>
          本轮 {toolCalls.length} 次工具调用
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {steps.map((step, index) => <Step key={step.title} index={index + 1} compact={compact} {...step} />)}
      </div>
    </section>
  );
}
