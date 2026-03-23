import { ArrowPathIcon, SpeakerXMarkIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import PropTypes from "prop-types"
import { useCallback, useEffect, useState } from "react"
import Toggle from "../properties/Toggle"

export default function AppAudioControl({ onExcludedAppsChange }) {

  const [excludedPids, setExcludedPids] = useState(new Set())

  const { data: sessions, isPending, refetch } = useQuery({
    queryKey: ['audioSessions'],
    queryFn: () => window.electron.ipcRenderer.invoke("get-audio-sessions"),
    refetchInterval: 5000,
    gcTime: 0,
  })

  useEffect(() => {
    onExcludedAppsChange(Array.from(excludedPids))
  }, [excludedPids, onExcludedAppsChange])

  const toggleApp = useCallback((pid) => {
    setExcludedPids(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }, [])

  const hasSessions = sessions && sessions.length > 0

  return (
    <div className="mt-2 pt-2 border-t border-base-content/5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-base-content/30 uppercase tracking-wider">App Audio</span>
        <button
          onClick={() => refetch()}
          disabled={isPending}
          className="btn btn-ghost btn-xs size-5 min-h-0 p-0"
        >
          <ArrowPathIcon className={`size-3 text-base-content/30 ${isPending ? "animate-spin" : ""}`} />
        </button>
      </div>
      {!hasSessions && (
        <div className="text-[11px] text-base-content/25 py-1.5 text-center">
          No apps playing audio
        </div>
      )}
      {hasSessions && (
        <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto">
          {sessions.map(({ pid, name }) => (
            <div key={pid} className="flex items-center gap-2 py-0.5 px-0.5 rounded hover:bg-base-content/3">
              {excludedPids.has(pid) ? (
                <SpeakerXMarkIcon className="size-3.5 text-error/50 flex-shrink-0" />
              ) : (
                <div className="size-3.5 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <div className="size-1.5 rounded-full bg-success" />
                </div>
              )}
              <span className="text-xs text-base-content/60 flex-1 min-w-0 truncate">{name}</span>
              <div className="scale-75 origin-right">
                <Toggle
                  value={!excludedPids.has(pid)}
                  onChange={() => toggleApp(pid)}
                  justifyBetween={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

AppAudioControl.propTypes = {
  onExcludedAppsChange: PropTypes.func.isRequired,
}
