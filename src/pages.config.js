import Dashboard from './pages/Dashboard';
import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';
import Invitations from './pages/Invitations';


export const PAGES = {
    "Dashboard": Dashboard,
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
    "Profile": Profile,
    "Invitations": Invitations,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};