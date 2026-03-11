import {
  PencilSquareIcon,
  PlusIcon
} from "@heroicons/react/20/solid"
import PropTypes from 'prop-types'
import { useState } from "react"
import TitleBar from "../../../components/TitleBar"
import ExportButton from "./ExportButton"
import NewRecording from "./newRecording/NewRecording"
import Projects from "./projects/Projects"
import ActivateButton from "./titleBar/ActivateButton"
import RequestFeatureButton from "./titleBar/RequestFeatureButton"
import SettingsButton from "./titleBar/SettingsButton"

const TAB_NEW_RECORDING = "new"
const TAB_OPEN_PROJECT = "open"

export default function Launcher() {

  const [openTab, setOpenTab] = useState(TAB_NEW_RECORDING)

  return (<>
    <TitleBar overlayButtons={3} >
      <ExportButton />
      <ActivateButton />
      <RequestFeatureButton />
      <SettingsButton />
    </TitleBar>

    <div className="flex flex-col h-full w-full items-center justify-center">
      <div className="flex flex-col h-full w-full max-w-5xl px-10 py-10">

        <div role="tablist" className="tabs tabs-lg">
          <Tab text="New Recording" icon={PlusIcon} isOpen={openTab === TAB_NEW_RECORDING}
            onClick={() => setOpenTab(TAB_NEW_RECORDING)} />
          <Tab text="Open Project" icon={PencilSquareIcon} isOpen={openTab === TAB_OPEN_PROJECT}
            onClick={() => setOpenTab(TAB_OPEN_PROJECT)} />
        </div>

        <NewRecording isOpen={openTab === TAB_NEW_RECORDING} />
        <Projects isOpen={openTab === TAB_OPEN_PROJECT} />

      </div>
    </div>
  </>)
}

function Tab({ onClick, isOpen, icon: Icon, text }) {
  return (
    <a role="tab" onClick={onClick} className={`tab ${isOpen ? "tab-active" : ""}`}>
      <Icon className="h-5 w-5 me-2" />
      {text}
    </a>)
}

Tab.propTypes = {
  onClick: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  icon: PropTypes.elementType.isRequired,
  text: PropTypes.string.isRequired
}