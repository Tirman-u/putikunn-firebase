import AdminUsers from './pages/AdminUsers';
import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import DuelHost from './pages/DuelHost';
import DuelJoin from './pages/DuelJoin';
import DuelSolo from './pages/DuelSolo';
import PuttingKing from './pages/PuttingKing';
import PuttingKingOverview from './pages/PuttingKingOverview';
import PuttingKingScoring from './pages/PuttingKingScoring';
import PuttingKingSetup from './pages/PuttingKingSetup';
import PuttingRecordsPage from './pages/PuttingRecordsPage';
import HostDuelPreviewPage from './pages/HostDuelPreview';
import PlayerDuelPreviewPage from './pages/PlayerDuelPreview';
import SoloDuelPreviewPage from './pages/SoloDuelPreview';
import SubmitDiscgolf from './pages/SubmitDiscgolf';


export const PAGES = {
    "AdminUsers": AdminUsers,
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "DuelHost": DuelHost,
    "DuelJoin": DuelJoin,
    "DuelSolo": DuelSolo,
    "PuttingKing": PuttingKing,
    "PuttingKingOverview": PuttingKingOverview,
    "PuttingKingScoring": PuttingKingScoring,
    "PuttingKingSetup": PuttingKingSetup,
    "PuttingRecordsPage": PuttingRecordsPage,
    "HostDuelPreview": HostDuelPreviewPage,
    "PlayerDuelPreview": PlayerDuelPreviewPage,
    "SoloDuelPreview": SoloDuelPreviewPage,
    "SubmitDiscgolf": SubmitDiscgolf,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};
