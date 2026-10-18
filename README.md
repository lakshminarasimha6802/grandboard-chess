# Grandboard Chess

A static, local-first chess website for a quick match. You can use it offline, publish the folder, or optionally install Stockfish 19.

## Play now on Windows

1. Extract the ZIP and keep its files together in a folder.
2. Double-click `index.html` to play immediately (the built-in offline opponent works without setup).
3. Or double-click `START_ON_WINDOWS.bat` to open `http://localhost:8765` if Python is installed. Leave the black terminal window running while you play.
4. In the site, select **Player vs computer**, **Player vs player** (both people on one device), or **Manual board**. Select 10 min, 20 min or unlimited. Press **Start playing**.

A live online URL is *not* included in the ZIP. To put this online in minutes, drag the unzipped `grandboard-chess` folder into https://app.netlify.com/drop. The publishing service gives you a shareable URL. No database, build system, or account within Grandboard is required.

## Strengths and limitations

Five modes: Beginner (~800), Intermediate (~1200), Senior (~1700), Master (~2200), Grandmaster (2800+). These are **illustrative Elo difficulty labels**, not certified Elo scores or chess IQ measurements. The beginner/intermediate setting intentionally uses the local engine. Stronger levels try to run the open-source **Stockfish 19 ASM-JS** engine from jsDelivr when the browser has internet access; when the engine cannot be loaded, the site uses its bundled offline minimax AI. **The bundled fallback is not grandmaster strength.** The status line beneath the controls tells you which engine is active.

For a stronger and more dependable local engine on Windows (requires internet once to download and Python to serve the website):

1. Open PowerShell in this folder.
2. Run `powershell -ExecutionPolicy Bypass -File .\INSTALL_STOCKFISH_WINDOWS.ps1`.
3. Double-click `START_ON_WINDOWS.bat`.
4. The interface should show `Stockfish 19 WASM · strongest mode` when ready.

Stockfish comes from the npm stockfish package. Stockfish.js is GPLv3 licensed: https://github.com/nmrugg/stockfish.js/ . This project links to it as a separate engine rather than bundling its source. Users installing/distributing Stockfish must honor its license.

## Using the game

- **Move pieces:** click source then target, or drag pieces. Legal moves are highlighted. Promotion offers four pieces.
- **Two human players:** share one screen; set separate hint strengths for White and Black.
- **Hint · play best move:** plays a suggested legal move for the current side. Stockfish is used when it is available and the level warrants it.
- **Undo:** reverses one move in human-v-human mode, or your move plus the computer reply if both were played.
- **Review:** click a move in the history or use arrow controls (also keyboard left/right arrow, Home/End); clocks pause. Use **Continue from this move** to replace the remaining line with a new continuation.
- **Edit this position:** opens a board editor at the currently viewed move. Select a piece and click a square, or use Erase / right-click. When the edited position is legal, it starts as a *new numbered game*; the source game remains intact.
- **Manual board:** place pieces, remove pieces, choose the side to move, and play two-player chess from that position. Custom castling availability is derived from king and rook starting squares; en passant targets are reset.
- **Save:** games are automatically recorded as Game 1, Game 2 etc. in the same browser using localStorage, not on an internet server. Press **Open** beside a game to review from move zero. Export a `.pgn` backup for portability.
- **Clock:** unlimited, 10 minutes per player, or 20 minutes per player. Clocks pause during review. Closing the browser stops the clock; it does not continue counting down in the background after closing the tab.

## Notes

This first version does not include remote internet multiplayer, login/accounts, cross-device sync, anti-cheat, or cloud storage. An internet game server and database would be needed for those features. For best long-term backups, use **Export PGN**.

### Files

- `index.html` — site markup
- `style.css` — dark-green responsive design
- `chess-core.js` — chess rules and move validation
- `app.js` — interface, AI, saved games, clocks, analysis
- `START_ON_WINDOWS.bat` — optional local HTTP server launcher
- `INSTALL_STOCKFISH_WINDOWS.ps1` — optional stronger WASM engine downloader
