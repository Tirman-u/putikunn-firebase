import GameResult from './pages/GameResult';
import GroupResult from './pages/GroupResult';
import Home from './pages/Home';
import ManageGames from './pages/ManageGames';
import Profile from './pages/Profile';


export const PAGES = {
    "GameResult": GameResult,
    "GroupResult": GroupResult,
    "Home": Home,
    "ManageGames": ManageGames,
    "Profile": Profile,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
};