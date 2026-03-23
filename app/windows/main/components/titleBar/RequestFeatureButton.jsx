import { CodeBracketSquareIcon } from "@heroicons/react/16/solid"

export default function RequestFeatureButton() {
    return (<button className="mt-1 btn btn-xs"
        onClick={() => window.electron.ipcRenderer.invoke("open-url-in-browser", "https://github.com/JNX03/Flowtake/issues")}>
        <CodeBracketSquareIcon className="size-4" />
        Request a feature
    </button>)
}

