import {
  Cog6ToothIcon,
  FolderOpenIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline"
import {
  CodeBracketSquareIcon,
  QueueListIcon,
} from "@heroicons/react/16/solid"
import PropTypes from 'prop-types'
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import TitleBar from "../../../components/TitleBar"
import ExportButton from "./ExportButton"
import NewRecording from "./newRecording/NewRecording"
import Projects from "./projects/Projects"
import { setOpenSettings } from "../../../src/redux/appSlice"
import { SETTINGS_GENERAL } from "./settings/constants"
import { selectHasLicense } from "../../../src/redux/licenseSlice"

const VIEW_RECORD = "record"
const VIEW_PROJECTS = "projects"

export default function Launcher() {

  const [activeView, setActiveView] = useState(VIEW_RECORD)
  const dispatch = useDispatch()
  const hasLicense = useSelector(selectHasLicense)

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
          icon={CodeBracketSquareIcon}
          label="Feedback"
          onClick={() => window.open("https://insigh.to/b/flowtake", "_blank")}
        />
        <SidebarItem
          icon={Cog6ToothIcon}
          label="Settings"
          onClick={() => dispatch(setOpenSettings(SETTINGS_GENERAL))}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="h-full w-full max-w-5xl mx-auto px-8 py-6">
          {/* View header */}
          <div className="mb-6">
            <h2 className="font-brand font-semibold text-lg text-base-content/90">
              {activeView === VIEW_RECORD ? "New Recording" : "My Projects"}
            </h2>
            <p className="text-xs text-base-content/40 mt-1">
              {activeView === VIEW_RECORD
                ? "Set up your recording source, camera, and microphone"
                : "Open a recent recording or find a project file"}
            </p>
          </div>

          <NewRecording isOpen={activeView === VIEW_RECORD} />
          <Projects isOpen={activeView === VIEW_PROJECTS} />
        </div>
      </main>
    </div>
  </>)
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
