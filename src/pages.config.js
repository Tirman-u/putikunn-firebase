import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import PuttingKing from './pages/PuttingKing';
import PuttingKingOverview from './pages/PuttingKingOverview';
import PuttingKingScoring from './pages/PuttingKingScoring';
import PuttingKingSetup from './pages/PuttingKingSetup';
import Home from './pages/Home';


export const PAGES = {
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "PuttingKing": PuttingKing,
    "PuttingKingOverview": PuttingKingOverview,
    "PuttingKingScoring": PuttingKingScoring,
    "PuttingKingSetup": PuttingKingSetup,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "PuttingKingSetup",
    Pages: PAGES,
};