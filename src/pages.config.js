import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import PuttingKing from './pages/PuttingKing';
import PuttingKingSetup from './pages/PuttingKingSetup';
import PuttingKingOverview from './pages/PuttingKingOverview';
import PuttingKingScoring from './pages/PuttingKingScoring';


export const PAGES = {
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "PuttingKing": PuttingKing,
    "PuttingKingSetup": PuttingKingSetup,
    "PuttingKingOverview": PuttingKingOverview,
    "PuttingKingScoring": PuttingKingScoring,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};