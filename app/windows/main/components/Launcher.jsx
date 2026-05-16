import {
  Cog6ToothIcon,
  FolderOpenIcon,
  PuzzlePieceIcon,
  SignalIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import {
  CodeBracketSquareIcon,
} from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import { useState } from "react"
import { useDispatch } from "react-redux"
import { useQuery } from "@tanstack/react-query"
import logo from "@shared/assets/logo.svg"
import TitleBar from "../../../components/TitleBar"
import ExportButton from "./ExportButton"
import Live from "./live/Live"
import NewRecording from "./newRecording/NewRecording"
import Plugins from "./plugins/Plugins"
import Projects from "./projects/Projects"
import { setOpenSettings } from "@shared/redux/appSlice"
import { SETTINGS_GENERAL } from "./settings/constants"

const VIEW_RECORD = "record"
const VIEW_PROJECTS = "projects"
const VIEW_PLUGINS = "plugins"
const VIEW_LIVE = "live"

const VIEW_ORDER = [VIEW_RECORD, VIEW_PROJECTS, VIEW_LIVE, VIEW_PLUGINS]

const VIEW_META = {
  [VIEW_RECORD]:   { num: "01", label: "Record",   icon: VideoCameraIcon },
  [VIEW_PROJECTS]: { num: "02", label: "Library",  icon: FolderOpenIcon },
  [VIEW_LIVE]:     { num: "03", label: "Live",     icon: SignalIcon },
  [VIEW_PLUGINS]:  { num: "04", label: "Plugins",  icon: PuzzlePieceIcon },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return "Working late,"
  if (h < 12) return "Good morning,"
  if (h < 18) return "Good afternoon,"
  return "Good evening,"
}

function getHeadline({ activeView, isFirstRun }) {
  if (activeView === VIEW_RECORD) {
    if (isFirstRun) return { line1: "Hello,", accent: "welcome." }
    return { line1: getGreeting(), accent: "ready." }
  }
  if (activeView === VIEW_PROJECTS) return { line1: "Your", accent: "archive." }
  if (activeView === VIEW_LIVE)     return { line1: "Go", accent: "live." }
  if (activeView === VIEW_PLUGINS)  return { line1: "Extend the", accent: "runtime." }
  return { line1: "", accent: "" }
}

function getDescription({ activeView, totalProjects }) {
  if (activeView === VIEW_RECORD) {
    return "Pick a source, set up audio, then hit record. Auto-zoom does the rest."
  }
  if (activeView === VIEW_PROJECTS) {
    return totalProjects > 0
      ? `${totalProjects} ${totalProjects === 1 ? "project" : "projects"} saved locally.`
      : "Your recordings will appear here."
  }
  if (activeView === VIEW_LIVE) {
    return "Pick a source, set up audio, then hit Go Live. Hold the zoom hotkey to zoom in mid-stream."
  }
  return "Toggle built-in extensions and drop in your own (research preview)."
}

export default function Launcher() {

  const [activeView, setActiveView] = useState(VIEW_RECORD)
  const dispatch = useDispatch()
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
    staleTime: Infinity
  })
  const { data: launchCount } = useQuery({
    queryKey: ['launchCount'],
    queryFn: () => window.electron.ipcRenderer.invoke("store-get", "launchCount"),
    staleTime: Infinity
  })
  const { data: projectsMeta } = useQuery({
    queryKey: ['projects-meta'],
    queryFn: async () => {
      const raw = await window.electron.ipcRenderer.invoke("store-get", "projects")
      if (!raw || typeof raw !== "object") return { count: 0 }
      const count = Object.values(raw).filter(p => p && p.lastSaved != null).length
      return { count }
    },
    staleTime: 60_000,
  })

  const totalProjects = projectsMeta?.count ?? 0
  const isFirstRun = (launchCount ?? 0) <= 1
  const headline = getHeadline({ activeView, isFirstRun })
  const description = getDescription({ activeView, totalProjects })

  const statusLabel = isFirstRun
    ? "New session"
    : totalProjects > 0
      ? `${totalProjects} ${totalProjects === 1 ? "take" : "takes"} on disk`
      : "Ready"

  return (<>
    <TitleBar>
      <ExportButton />
    </TitleBar>

    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="flowtake-sidebar-rail relative w-[64px] flex-shrink-0 bg-base-200/30 border-r border-base-content/5 flex flex-col items-center py-4 gap-1.5">
        <div className="size-9 rounded-xl flex items-center justify-center mb-2 overflow-hidden relative">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--color-primary) 35%, transparent), 0 0 18px color-mix(in oklab, var(--color-primary) 25%, transparent)" }}
          />
          <img src={logo} alt="Flowtake" className="size-7 relative" />
        </div>

        {VIEW_ORDER.map(view => (
          <SidebarItem
            key={view}
            icon={VIEW_META[view].icon}
            label={VIEW_META[view].label}
            active={activeView === view}
            badge={view === VIEW_PROJECTS && totalProjects > 0 ? totalProjects : null}
            onClick={() => setActiveView(view)}
          />
        ))}

        <div className="flex-1" />

        <SidebarItem
          icon={GitHubIcon}
          label="GitHub"
          onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake")}
        />
        <SidebarItem
          icon={CodeBracketSquareIcon}
          label="Feedback"
          onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/issues")}
        />
        <SidebarItem
          icon={Cog6ToothIcon}
          label="Settings"
          onClick={() => dispatch(setOpenSettings(SETTINGS_GENERAL))}
        />
      </aside>

      {/* Main stage */}
      <main className="flowtake-stage flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="flowtake-grain" />

        <div className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto px-5 md:px-8 pt-2 pb-2 flex flex-col overflow-hidden">

          {/* Eyebrow + status pill */}
          <header className="flex-shrink-0 flex items-center justify-between gap-3 mb-1.5">
            <p className="flowtake-eyebrow flowtake-rise flex items-center gap-2">
              <span className="inline-block h-px w-4 bg-base-content/35" />
              {isFirstRun ? "First take" : "Now playing"}
              <span className="text-base-content/25">&middot;</span>
              v{version || "—"}
              <span className="text-base-content/25">&middot;</span>
              MIT
            </p>

            <span className="flowtake-status-pill flowtake-rise" style={{ animationDelay: "0.05s" }}>
              <span className="flowtake-status-pill__dot" />
              {statusLabel}
            </span>
          </header>

          {/* Hero headline */}
          <div className="flex-shrink-0">
            <h1
              key={`${activeView}-${isFirstRun}`}
              className="flowtake-display flowtake-rise text-[26px] md:text-[34px] lg:text-[40px] text-base-content/95 whitespace-nowrap"
              style={{ animationDelay: "0.08s" }}
            >
              {headline.line1}{" "}
              <em className="flowtake-display--italic text-primary">
                {headline.accent}
              </em>
            </h1>
            <p
              className="flowtake-rise mt-1 text-[12px] md:text-[13px] text-base-content/55 max-w-xl leading-snug"
              style={{ animationDelay: "0.18s" }}
            >
              {description}
            </p>
          </div>

          {/* First-run pull-quote */}
          {isFirstRun && activeView === VIEW_RECORD && (
            <div
              className="flowtake-pullquote flowtake-pullquote--compact flowtake-rise flex-shrink-0 mt-2 max-w-xl"
              style={{ animationDelay: "0.24s" }}
            >
              <p className="flowtake-pullquote__lead">
                Enable system audio and a microphone for tutorials. Cursor zoom, masks, and click effects are choreographed automatically.
              </p>
            </div>
          )}

          {/* Numbered navigation */}
          <nav
            className="flowtake-rise flex-shrink-0 mt-2.5 flex items-baseline gap-5 md:gap-7 border-t border-base-content/10 pt-2"
            style={{ animationDelay: "0.28s" }}
            aria-label="Primary"
          >
            {VIEW_ORDER.map(view => {
              const meta = VIEW_META[view]
              const isActive = activeView === view
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className="flowtake-nav-item"
                  data-active={isActive ? "true" : "false"}
                >
                  <span className="flowtake-numeral">{meta.num}</span>
                  <span>{meta.label}</span>
                  {view === VIEW_PROJECTS && totalProjects > 0 && (
                    <span className="ml-0.5 text-[10px] text-base-content/35 font-medium tabular-nums">
                      ({totalProjects})
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Content surface */}
          <section
            className="flowtake-rise flex-1 min-h-0 mt-2.5 overflow-hidden"
            style={{ animationDelay: "0.34s" }}
          >
            <NewRecording isOpen={activeView === VIEW_RECORD} />
            <Projects isOpen={activeView === VIEW_PROJECTS} />
            <Live isOpen={activeView === VIEW_LIVE} />
            <Plugins isOpen={activeView === VIEW_PLUGINS} />
          </section>
        </div>
      </main>
    </div>
  </>)
}

function GitHubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

GitHubIcon.propTypes = {
  className: PropTypes.string
}

function SidebarItem({ onClick, active, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className="flowtake-sidebar-rail__item tooltip tooltip-right"
      data-tip={label}
      data-active={active ? "true" : "false"}
    >
      {active && (
        <span className="flowtake-sidebar-rail__accent" aria-hidden="true" />
      )}
      <Icon className="size-5" />
      {badge != null && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-base-content/15 text-base-content/80 text-[9px] font-semibold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

SidebarItem.propTypes = {
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  badge: PropTypes.number,
}
