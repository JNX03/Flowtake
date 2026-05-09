import {
  Cog6ToothIcon,
  FolderOpenIcon,
  PuzzlePieceIcon,
  SignalIcon,
  VideoCameraIcon,
  SparklesIcon,
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

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
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
  const greeting = getGreeting()

  return (<>
    <TitleBar>
      <ExportButton />
    </TitleBar>

    <div className="flex h-full overflow-hidden bg-base-100">
      {/* Sidebar */}
      <aside className="w-[60px] flex-shrink-0 bg-base-200/40 border-r border-base-content/5 flex flex-col items-center py-3 gap-1">
        <div className="size-9 rounded-xl flex items-center justify-center mb-2 overflow-hidden">
          <img src={logo} alt="Flowtake" className="size-7" />
        </div>
        <SidebarItem
          icon={VideoCameraIcon}
          label="Record"
          active={activeView === VIEW_RECORD}
          onClick={() => setActiveView(VIEW_RECORD)}
        />
        <SidebarItem
          icon={FolderOpenIcon}
          label="Projects"
          active={activeView === VIEW_PROJECTS}
          badge={totalProjects > 0 ? totalProjects : null}
          onClick={() => setActiveView(VIEW_PROJECTS)}
        />
        <SidebarItem
          icon={SignalIcon}
          label="Live Stream"
          active={activeView === VIEW_LIVE}
          onClick={() => setActiveView(VIEW_LIVE)}
        />
        <SidebarItem
          icon={PuzzlePieceIcon}
          label="Plugins"
          active={activeView === VIEW_PLUGINS}
          onClick={() => setActiveView(VIEW_PLUGINS)}
        />

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

      {/* Main content */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
        {/* Subtle theme-aware backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 60%)"
          }}
        />

        <div className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto px-5 md:px-7 pt-3 pb-3 flex flex-col overflow-hidden">
          {/* Hero header */}
          <header className="flex-shrink-0 mb-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-base-content/40 mb-0.5">
                {greeting}
              </p>
              <h1 className="font-brand font-semibold text-xl md:text-2xl text-base-content leading-tight truncate">
                {activeView === VIEW_RECORD
                  ? (isFirstRun ? "Capture your first recording" : "Ready to record")
                  : activeView === VIEW_PROJECTS
                    ? "My projects"
                    : activeView === VIEW_LIVE
                      ? "Go live"
                      : "Plugins & Extensions"}
              </h1>
              <p className="text-xs text-base-content/50 mt-1 truncate">
                {activeView === VIEW_RECORD
                  ? "Pick a source, set up audio, then hit record. Auto-zoom does the rest."
                  : activeView === VIEW_PROJECTS
                    ? (totalProjects > 0
                      ? `${totalProjects} ${totalProjects === 1 ? "project" : "projects"} saved locally`
                      : "Your recordings will appear here")
                    : activeView === VIEW_LIVE
                      ? "Stream Flowtake's smoothed cursor straight to YouTube, Twitch, or any RTMP target"
                      : "Toggle built-in extensions and drop in your own (research preview)"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <SegmentedTab
                items={[
                  { id: VIEW_RECORD, label: "Record", icon: VideoCameraIcon },
                  { id: VIEW_PROJECTS, label: "Projects", icon: FolderOpenIcon },
                  { id: VIEW_LIVE, label: "Live", icon: SignalIcon },
                  { id: VIEW_PLUGINS, label: "Plugins", icon: PuzzlePieceIcon },
                ]}
                active={activeView}
                onChange={setActiveView}
              />
              <button
                onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake")}
                className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-base-content/45 hover:text-base-content/80 transition-colors px-2 py-1 rounded-md hover:bg-base-content/5"
                title={`Flowtake ${version || ""} · MIT License`}
              >
                <GitHubIcon className="size-3.5" />
                <span>v{version || "—"}</span>
              </button>
            </div>
          </header>

          {/* First-run tip card */}
          {isFirstRun && activeView === VIEW_RECORD && (
            <div className="flex-shrink-0 mb-3 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
              <SparklesIcon className="size-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-base-content/85">Welcome to Flowtake</p>
                <p className="text-[11px] text-base-content/55 mt-0.5">
                  Tip: enable system audio and a microphone for tutorials. Cursor zoom, masks, and click effects are added automatically.
                </p>
              </div>
            </div>
          )}

          {/* Content area */}
          <section className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-base-content/5 bg-base-100/60 backdrop-blur-sm shadow-sm p-3 md:p-4">
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
      className={`relative tooltip tooltip-right w-10 h-10 rounded-lg flex items-center justify-center transition-all
        ${active
          ? "bg-primary/15 text-primary"
          : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5"
        }`}
      data-tip={label}
    >
      <Icon className="size-5" />
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
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

function SegmentedTab({ items, active, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-base-200/60 border border-base-content/5">
      {items.map(item => {
        const Icon = item.icon
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all
              ${isActive
                ? "bg-base-100 text-base-content shadow-sm"
                : "text-base-content/55 hover:text-base-content/85"
              }`}
          >
            <Icon className="size-3.5" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

SegmentedTab.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
  })).isRequired,
  active: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
}
