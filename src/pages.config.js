import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import PuttingKing from './pages/PuttingKing';
import PuttingKingOverview from './pages/PuttingKingOverview';
import PuttingKingScoring from './pages/PuttingKingScoring';
import PuttingKingSetup from './pages/PuttingKingSetup';
import AdminUsers from './pages/AdminUsers';
import PuttingRecordsPage from './pages/PuttingRecordsPage';


export const PAGES = {
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "PuttingKing": PuttingKing,
    "PuttingKingOverview": PuttingKingOverview,
    "PuttingKingScoring": PuttingKingScoring,
    "PuttingKingSetup": PuttingKingSetup,
    "AdminUsers": AdminUsers,
    "PuttingRecordsPage": PuttingRecordsPage,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};