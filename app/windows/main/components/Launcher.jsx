import {
  Cog6ToothIcon,
  FolderOpenIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import {
  CodeBracketSquareIcon,
} from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useQuery } from "@tanstack/react-query"
import TitleBar from "../../../components/TitleBar"
import ExportButton from "./ExportButton"
import NewRecording from "./newRecording/NewRecording"
import Projects from "./projects/Projects"
import { setOpenSettings } from "@shared/redux/appSlice"
import { SETTINGS_GENERAL } from "./settings/constants"

const VIEW_RECORD = "record"
const VIEW_PROJECTS = "projects"

export default function Launcher() {

  const [activeView, setActiveView] = useState(VIEW_RECORD)
  const dispatch = useDispatch()
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.electron.ipcRenderer.invoke("get-version"),
    staleTime: Infinity
  })

  return (<>
    <TitleBar>
      <ExportButton />
    </TitleBar>

    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[52px] flex-shrink-0 bg-base-200/40 border-r border-base-content/5 flex flex-col items-center py-3 gap-1">
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
          onClick={() => setActiveView(VIEW_PROJECTS)}
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
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col">
          {/* Compact header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h2 className="font-brand font-semibold text-lg text-base-content/90">
                {activeView === VIEW_RECORD ? "New Recording" : "My Projects"}
              </h2>
              <p className="text-xs text-base-content/40 mt-0.5">
                {activeView === VIEW_RECORD
                  ? "Set up your recording source, camera, and microphone"
                  : "Open a recent recording or find a project file"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake")}
                className="badge badge-sm bg-base-200/60 border-base-content/10 text-base-content/50 gap-1.5 hover:text-base-content/80 hover:bg-base-200 transition-colors cursor-pointer"
              >
                <GitHubIcon className="size-3" />
                Open Source
              </button>
            </div>
          </div>

          {/* Content area - takes remaining space */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <NewRecording isOpen={activeView === VIEW_RECORD} />
            <Projects isOpen={activeView === VIEW_PROJECTS} />
          </div>

          {/* Bottom bar */}
          <div className="flex-shrink-0 pt-3 flex items-center justify-between text-[10px] text-base-content/25 pointer-events-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">,</kbd> Settings
              </span>
              <span className="flex items-center gap-1">
                <kbd className="kbd kbd-xs">Ctrl</kbd>+<kbd className="kbd kbd-xs">/</kbd> Hotkeys
              </span>
            </div>
            <span>Flowtake {version || ""} &middot; MIT License</span>
          </div>
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

function SidebarItem({ onClick, active, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`tooltip tooltip-right w-10 h-10 rounded-lg flex items-center justify-center transition-all
        ${active
          ? "bg-primary/15 text-primary"
          : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5"
        }`}
      data-tip={label}
    >
      <Icon className="size-5" />
    </button>
  )
}

SidebarItem.propTypes = {
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool,
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired
}
