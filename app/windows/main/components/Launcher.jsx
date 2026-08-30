import {
  Cog6ToothIcon,
  FolderOpenIcon,
  PuzzlePieceIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import {
  CodeBracketSquareIcon,
} from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import { lazy, Suspense, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useQuery } from "@tanstack/react-query"
import logo from "@shared/assets/logo.svg"
import TitleBar from "../../../components/TitleBar"
import ExportButton from "./ExportButton"
import {
  selectCapturers,
  selectEncoders,
  setOpenSettings,
} from "@shared/redux/appSlice"
import { SETTINGS_GENERAL } from "./settings/constants"

const NewRecording = lazy(() => import("./newRecording/NewRecording"))
const Projects = lazy(() => import("./projects/Projects"))
const Plugins = lazy(() => import("./plugins/Plugins"))

const VIEW_RECORD = "record"
const VIEW_PROJECTS = "projects"
const VIEW_PLUGINS = "plugins"

const VIEW_ORDER = [VIEW_RECORD, VIEW_PROJECTS]
const EXPERIMENTAL_VIEW_ORDER = [VIEW_PLUGINS]

const VIEW_META = {
  [VIEW_RECORD]: {
    label: "Record",
    icon: VideoCameraIcon,
    description: "Choose a source, confirm quality, and start a reliable local recording.",
  },
  [VIEW_PROJECTS]: {
    label: "Library",
    icon: FolderOpenIcon,
    description: "Open a recording or continue a saved project.",
  },
  [VIEW_PLUGINS]: {
    label: "Plugins",
    icon: PuzzlePieceIcon,
    description: "Enable built-in experimental recording tools.",
  },
}

export default function Launcher() {

  const [activeView, setActiveView] = useState(VIEW_RECORD)
  const dispatch = useDispatch()
  const capturers = useSelector(selectCapturers)
  const encoders = useSelector(selectEncoders)
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
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
  const activeMeta = VIEW_META[activeView]
  const recorderReady = capturers.length > 0 && encoders.length > 0
  const statusLabel = activeView === VIEW_RECORD
    ? recorderReady ? "Ready" : "Setup needed"
    : activeView === VIEW_PLUGINS ? "Experimental" : "Stored locally"

  return (<>
    <TitleBar>
      <ExportButton />
    </TitleBar>

    <div className="flex h-full overflow-hidden">
      <aside className="flowtake-sidebar-rail relative w-14 sm:w-44 flex-shrink-0 bg-base-200/30 border-r border-base-content/5 flex flex-col items-center sm:items-stretch px-2 py-3 gap-1">
        <div className="h-10 flex items-center justify-center sm:justify-start sm:px-2 gap-2 mb-2">
          <div className="size-8 rounded-xl flex items-center justify-center overflow-hidden relative flex-shrink-0">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl"
              style={{ boxShadow: "0 0 0 1px color-mix(in oklab, var(--color-primary) 35%, transparent), 0 0 18px color-mix(in oklab, var(--color-primary) 25%, transparent)" }}
            />
            <img src={logo} alt="" className="size-6 relative" />
          </div>
          <span className="hidden sm:block font-brand font-semibold text-sm">Flowtake</span>
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

        <div className="hidden sm:block px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-base-content/30">
          Experimental
        </div>
        <div className="sm:hidden my-1 border-t border-base-content/5" aria-hidden="true" />
        {EXPERIMENTAL_VIEW_ORDER.map(view => (
          <SidebarItem
            key={view}
            icon={VIEW_META[view].icon}
            label={`${VIEW_META[view].label} (experimental)`}
            visibleLabel={VIEW_META[view].label}
            active={activeView === view}
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
        <div className="hidden sm:flex items-center justify-between px-3 pt-2 mt-1 border-t border-base-content/5 text-[10px] text-base-content/35">
          <span>Local recorder</span>
          <span>v{version || "—"}</span>
        </div>
      </aside>

      <main className="flowtake-stage flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div className="flowtake-grain" />
        <div className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto p-3 md:p-5 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <h1 className="font-brand font-semibold text-lg md:text-xl text-base-content/95">
                {activeMeta.label}
              </h1>
              <p className="text-xs md:text-sm text-base-content/55 leading-snug truncate sm:whitespace-normal">
                {activeView === VIEW_PROJECTS && totalProjects > 0
                  ? `${totalProjects} ${totalProjects === 1 ? "project" : "projects"} saved locally.`
                  : activeMeta.description}
              </p>
            </div>
            <span className="flowtake-status-pill flex-shrink-0" aria-label={`Recorder status: ${statusLabel}`}>
              <span className="flowtake-status-pill__dot" />
              {statusLabel}
            </span>
          </header>

          <section className="flex-1 min-h-0 overflow-hidden" aria-label={`${activeMeta.label} workspace`}>
            <Suspense fallback={<ViewLoading label={activeMeta.label} />}>
              {activeView === VIEW_RECORD && <NewRecording isOpen />}
              {activeView === VIEW_PROJECTS && <Projects isOpen />}
              {activeView === VIEW_PLUGINS && <Plugins isOpen />}
            </Suspense>
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

function SidebarItem({ onClick, active, icon: Icon, label, visibleLabel = label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tooltip tooltip-right sm:tooltip-none relative rounded-[0.6rem] w-10 sm:w-full h-10 sm:px-3 inline-flex items-center justify-center sm:justify-start sm:gap-3 transition-colors
        ${active
          ? "text-primary bg-primary/10"
          : "text-base-content/50 hover:text-base-content/85 hover:bg-base-content/5"
        }`}
      data-tip={label}
      data-active={active ? "true" : "false"}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span className="flowtake-sidebar-rail__accent" aria-hidden="true" />
      )}
      <Icon className="size-5" />
      <span className="hidden sm:inline text-xs font-medium">{visibleLabel}</span>
      {badge != null && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-base-content/15 text-base-content/80 text-[9px] font-semibold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  )
}

function ViewLoading({ label }) {
  return (
    <div className="h-full flex items-center justify-center gap-2 text-xs text-base-content/45" role="status">
      <span className="loading loading-spinner loading-sm" />
      Loading {label.toLowerCase()}…
    </div>
  )
}

ViewLoading.propTypes = {
  label: PropTypes.string.isRequired,
}

SidebarItem.propTypes = {
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  visibleLabel: PropTypes.string,
  badge: PropTypes.number,
}
