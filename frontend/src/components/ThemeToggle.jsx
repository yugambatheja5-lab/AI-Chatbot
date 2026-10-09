
import { Moon, Sun } from "lucide-react";
export default function ThemeToggle({theme,onToggle}) {
 return <button className="icon-button" onClick={onToggle} title={theme==="dark"?"Light mode":"Dark mode"} aria-label="Toggle theme">
   {theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}
 </button>
}
