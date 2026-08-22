/** Shared confirm text/behavior for ending a match — used by every game's "Quit Game" menu
 *  action so the prompt reads identically everywhere. */
export function confirmQuitGame(onQuit: () => void) {
  if (window.confirm("End this game now? You'll start a new one next time.")) onQuit();
}
