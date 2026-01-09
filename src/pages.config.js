import Dashboard from './pages/Dashboard';
import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';


export const PAGES = {
    "Dashboard": Dashboard,
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};