import { useSelector } from "react-redux"
import TitleBar from "../../../components/TitleBar"
import { selectLoaderMessage } from "@shared/redux/appSlice"

function splitMessage(raw) {
    if (!raw) return { prefix: "", accent: "" }
    const trimmed = String(raw).replace(/[.…]+$/, "").trim()
    if (!trimmed) return { prefix: "", accent: "" }
    const parts = trimmed.split(/\s+/)
    if (parts.length === 1) return { prefix: "", accent: parts[0] }
    return {
        prefix: parts.slice(0, -1).join(" "),
        accent: parts[parts.length - 1],
    }
}

export default function Loader() {

    const loaderMessage = useSelector(selectLoaderMessage)
    const { prefix, accent } = splitMessage(loaderMessage)

    return (<>
        {loaderMessage && (
            <div className="flowtake-stage absolute inset-0 top-0 z-60 overflow-hidden">
                <TitleBar overlayButtons={3} />
                <div className="flowtake-grain" />

                <div className="relative h-full flex flex-col justify-end px-14 pb-16">
                    <p className="flowtake-eyebrow flowtake-rise inline-flex items-center gap-2.5 mb-5">
                        <span className="inline-block h-px w-4 bg-base-content/40" />
                        One moment &middot; rendering
                    </p>

                    <h1
                        className="flowtake-display flowtake-rise text-[64px] md:text-[84px] text-base-content/95 max-w-3xl"
                        style={{ animationDelay: "0.08s" }}
                    >
                        {prefix ? <>{prefix}<br /></> : null}
                        <em className="flowtake-display--italic text-primary">
                            {accent || "loading"}.
                        </em>
                    </h1>

                    <div
                        className="flowtake-rise mt-9 max-w-md"
                        style={{ animationDelay: "0.18s", "--rule-distance": "440px" }}
                    >
                        <div className="flowtake-rule">
                            <span className="flowtake-rule__accent" />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-base-content/40 font-medium">
                            <span>{loaderMessage}</span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="inline-block w-1.5 h-1.5 rounded-full bg-accent"
                                    style={{
                                        boxShadow: "0 0 10px color-mix(in oklab, var(--color-accent) 70%, transparent)",
                                        animation: "flowtake-status-pulse 1.4s ease-in-out infinite",
                                    }}
                                />
                                In progress
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>)
}
