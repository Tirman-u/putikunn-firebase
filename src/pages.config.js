import AdminUsers from './pages/AdminUsers';
import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import GroupProjector from './pages/GroupProjector';
import Home from './pages/Home';
import JoinTraining from './pages/JoinTraining';
import Login from './pages/Login';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import TrainerGroups from './pages/TrainerGroups';
import TrainerProjector from './pages/TrainerProjector';
import TrainerGroupDashboard from './pages/TrainerGroupDashboard';
import DuelHost from './pages/DuelHost';
import DuelHostControl from './pages/DuelHostControl';
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
import { FEATURE_FLAGS } from './lib/feature-flags';


export const PAGES = {
    "Login": Login,
    "AdminUsers": AdminUsers,
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "GroupProjector": GroupProjector,
    "Home": Home,
    "JoinTraining": JoinTraining,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "TrainerGroups": TrainerGroups,
    "TrainerProjector": TrainerProjector,
    "TrainerGroupDashboard": TrainerGroupDashboard,
    "DuelHost": DuelHost,
    "DuelHostControl": DuelHostControl,
    "DuelJoin": DuelJoin,
    "DuelSolo": DuelSolo,
    "PuttingRecordsPage": PuttingRecordsPage,
    "HostDuelPreview": HostDuelPreviewPage,
    "PlayerDuelPreview": PlayerDuelPreviewPage,
    "SoloDuelPreview": SoloDuelPreviewPage,
    "SubmitDiscgolf": SubmitDiscgolf,
}

if (FEATURE_FLAGS.puttingKing) {
    PAGES.PuttingKing = PuttingKing;
    PAGES.PuttingKingOverview = PuttingKingOverview;
    PAGES.PuttingKingScoring = PuttingKingScoring;
    PAGES.PuttingKingSetup = PuttingKingSetup;
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};
