import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import Hint from "../../../../components/Hint"
import Fieldset from "../properties/Fieldset"
import SubtitlesGenerator from "../../subtitles/SubtitlesGenerator"

export default function SpeechToTextSettings() {
    const [languageSearch, setLanguageSearch] = useState("")

    const { data: defaultLanguage, isPending, refetch } = useQuery({
        queryKey: ['sttDefaultLanguage'],
        queryFn: () => window.electron.ipcRenderer.invoke("store-get", "sttDefaultLanguage"),
        staleTime: Infinity
    })

    const filteredLanguages = useMemo(() => {
        const entries = Object.entries(SubtitlesGenerator.INPUT_LANGUAGES)
        if (!languageSearch.trim()) return entries
        const query = languageSearch.toLowerCase()
        return entries.filter(([code, name]) =>
            name.toLowerCase().includes(query) || code.toLowerCase().includes(query)
        )
    }, [languageSearch])

    const onChangeLanguage = async (e) => {
        await window.electron.ipcRenderer.invoke("store-set", "sttDefaultLanguage", e.target.value)
        refetch()
    }

    return (<div className="flex flex-col gap-4">
        <h4 className="font-semibold text-lg">Speech to Text</h4>
        <span className="block">
            <Hint>
                This language is preselected when you generate subtitles from a recording. Speech recognition supports 99+ languages.
                First-time use downloads the local AI model (~75MB).
            </Hint>
        </span>

        <Fieldset legend="Default Language" description="Set the default language for speech recognition. You can still change the language per-recording in the editor.">
            <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                    aria-label="Search speech recognition languages"
                    type="text"
                    placeholder="Search languages..."
                    value={languageSearch}
                    onChange={e => setLanguageSearch(e.target.value)}
                    className="input input-sm w-full pl-9 mb-1"
                />
            </div>
            <select
                aria-label="Default speech recognition language"
                className="select select-sm w-full"
                value={isPending ? "en" : (defaultLanguage || "en")}
                onChange={onChangeLanguage}
                disabled={isPending}
                size={languageSearch ? Math.min(filteredLanguages.length, 8) : 1}
            >
                {filteredLanguages.map(([key, value]) =>
                    <option key={key} value={key}>{value}</option>
                )}
            </select>
            {languageSearch && filteredLanguages.length === 0 && (
                <div className="text-xs opacity-50 mt-1">No languages match your search.</div>
            )}
        </Fieldset>

    </div>)
}
