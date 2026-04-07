export default function ToolCallDisplay({ toolCalls = [] }) {
  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-emerald-200">Tool Invocation Trace</h3>
        <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100">
          {toolCalls.length} call(s)
        </span>
      </div>
      <div className="space-y-3">
        {toolCalls.length === 0 ? (
          <p className="text-sm text-slate-300/70">No tool calls in the latest turn.</p>
        ) : (
          toolCalls.map((call) => (
            <div key={call.id} className="rounded-xl border border-emerald-200/10 bg-slate-950/40 p-3 text-xs text-slate-200">
              <div className="mb-2 font-semibold text-emerald-200">{call.name}</div>
              <div className="mb-2">
                <div className="mb-1 text-slate-400">Input</div>
                <pre className="overflow-auto whitespace-pre-wrap text-slate-200">{JSON.stringify(call.input, null, 2)}</pre>
              </div>
              <div>
                <div className="mb-1 text-slate-400">Result</div>
                <pre className="overflow-auto whitespace-pre-wrap text-slate-200">{JSON.stringify(call.result, null, 2)}</pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
