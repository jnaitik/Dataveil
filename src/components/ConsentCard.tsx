interface ConsentCardProps {
  payloadPreview: string;
  onConsent: () => void;
  onCancel: () => void;
  reason?: string;
  isSubmitting?: boolean;
}

export function ConsentCard({
  payloadPreview,
  onConsent,
  onCancel,
  reason,
  isSubmitting = false,
}: ConsentCardProps) {
  return (
    <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-5 text-left max-w-xl mx-auto shadow-sm my-4">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          !
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900">Cloud Inference Consent Required</h4>
          <p className="text-xs text-amber-800 leading-relaxed">
            {reason || 'The local on-device model is currently unavailable or the payload exceeds local memory limits.'}
          </p>

          <div className="mt-3">
            <div className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Preview: Exact Summary Sent</span>
              <span className="text-emerald-700 font-normal">No raw cell values included</span>
            </div>
            <pre className="bg-white border border-amber-200 rounded-lg p-2.5 text-[11px] text-slate-700 font-mono overflow-x-auto max-h-32 whitespace-pre-wrap">
              {payloadPreview}
            </pre>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConsent}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-xs transition-colors flex items-center space-x-1"
            >
              {isSubmitting ? 'Routing to Cloud...' : 'Use cloud for this request (one time)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
