import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Camera, Trophy, Target, TrendingUp, Edit2, Save, X, Award, ExternalLink } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { GAME_FORMATS } from '@/components/putting/gameRules';
import AIInsights from '@/components/profile/AIInsights';
import AchievementsList, { getAchievements } from '@/components/profile/AchievementsList';
import LoadingState from '@/components/ui/loading-state';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [uploading, setUploading] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [filterFormat, setFilterFormat] = useState('all');
  const [filterPuttType, setFilterPuttType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const GAMES_PER_PAGE = 10;

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: async () => {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      return userDocSnap.exists() ? userDocSnap.data() : null;
    },
    enabled: !!user,
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery({
    queryKey: ['user-games', user?.uid],
    queryFn: async () => {
      const gamesRef = collection(db, "games");
      const q = query(gamesRef, where("playerUids", "array-contains", user.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!user
  });
  
    // NOTE: Tournament functionality is temporarily disabled for migration.
    const tournamentsLoading = false;
    const tournamentPlayers = [];
    const tournaments = [];

  const updateUserMutation = useMutation({
    mutationFn: async (newData) => {
      if (!user) return;

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: newData.displayName,
        photoURL: newData.photoURL,
      });

      // Update Firestore user document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: newData.displayName,
        bio: newData.bio,
        gender: newData.gender,
        photoURL: newData.photoURL,
      });

      return newData;
    },
    onSuccess: (updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.uid] });
      setIsEditing(false);
    }
  });

  const handleEdit = () => {
    setEditData({
      displayName: userData?.displayName || user?.displayName || '',
      bio: userData?.bio || '',
      photoURL: userData?.photoURL || user?.photoURL || '',
      gender: userData?.gender || ''
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateUserMutation.mutate(editData);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile_pictures/${user.uid}/${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const file_url = await getDownloadURL(uploadResult.ref);
      setEditData({ ...editData, photoURL: file_url });
    } catch (error) {
      console.error("Error uploading file:", error);
      alert('Pildi üleslaadimine ebaõnnestus');
    } finally {
      setUploading(false);
    }
  };
  
  const toDate = (date) => {
    if (date instanceof Timestamp) {
      return date.toDate();
    }
    if(typeof date === 'string' || typeof date === 'number') {
        return new Date(date);
    }
    return new Date(); // Fallback
  }

  if (userLoading || isLoadingAuth || gamesLoading || tournamentsLoading) {
    return <LoadingState />;
  }
  
  const myDisplayName = userData?.displayName || user?.displayName || 'Nimetu Kasutaja';
  const myGames = games; // Already filtered by query
  
  // Calculate ATW stats
  const atwGames = myGames.filter(g => g.game_type === 'around_the_world');
  const atwStatsByDifficulty = { easy: 0, medium: 0, hard: 0, ultra_hard: 0, impossible: 0 };
  atwGames.forEach(game => {
    if (game.atw_state && user?.uid && game.atw_state[user.uid]) {
      const playerState = game.atw_state[user.uid];
      const difficulty = game.atw_config?.difficulty || 'medium';
      const score = game.total_points?.[user.uid] || 0;
      atwStatsByDifficulty[difficulty] = Math.max(atwStatsByDifficulty[difficulty], score);
    }
  });

  // Calculate statistics
  const totalGames = myGames.length;
  const allPutts = myGames.flatMap(g => g.player_putts?.[user.uid] || []);
  const totalPutts = allPutts.length;
  const madePutts = allPutts.filter(p => p.result === 'made').length;
  const puttingPercentage = totalPutts > 0 ? ((madePutts / totalPutts) * 100).toFixed(1) : 0;

  let totalPoints = 0;
  let bestScore = 0;
  myGames.forEach(game => {
    const points = game.total_points?.[user.uid] || 0;
    totalPoints += points;
    if (points > bestScore) bestScore = points;
  });
  const avgScore = myGames.length > 0 ? Math.round(totalPoints / myGames.length) : 0;
  
  const isSuperAdmin = userData?.app_role === 'super_admin';
  const achievements = getAchievements({
    totalGames,
    puttingPercentage,
    bestScore,
    avgScore,
    allPutts,
    myGames,
    myName: myDisplayName
  }, isSuperAdmin);

  const unlockedAchievements = achievements.filter(a => a.unlocked);


  // Filter and sort games
  let filteredGames = myGames.filter(game => {
    if (filterFormat === 'all') return true;
    return game.game_type === filterFormat;
  });
  
  filteredGames = filteredGames.filter(game => {
    if (filterPuttType === 'all') return true;
    return (game.putt_type || 'regular') === filterPuttType;
  });

  filteredGames = filteredGames.sort((a, b) => {
    if (sortBy === 'date') {
      return toDate(b.date).getTime() - toDate(a.date).getTime();
    } else if (sortBy === 'score') {
      const scoreA = a.total_points?.[user.uid] || 0;
      const scoreB = b.total_points?.[user.uid] || 0;
      return scoreB - scoreA;
    } else if (sortBy === 'format') {
      return (a.game_type || 'classic').localeCompare(b.game_type || 'classic');
    }
    return 0;
  });
  
  const profilePicture = userData?.photoURL || user?.photoURL;
  const fullName = user?.displayName; // From Auth
  const email = user?.email;
  const gender = userData?.gender;
  const bio = userData?.bio;


  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Tagasi</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Minu profiil</h1>
          <div className="w-16" />
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          {!isEditing ? (
            <div className="flex items-start gap-4">
              <div className="relative">
                {profilePicture ? (
                  <img 
                    src={profilePicture} 
                    alt={fullName}
                    className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-3xl font-bold text-emerald-600">
                    {fullName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800">{myDisplayName}</h2>
                {myDisplayName !== fullName && (
                  <p className="text-sm text-slate-500">{fullName}</p>
                )}
                <p className="text-slate-500">{email}</p>
                {gender && (
                  <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold mt-1">
                    {gender === 'M' ? 'Mees' : 'Naine'}
                  </span>
                )}
                {bio && <p className="text-slate-600 mt-2">{bio}</p>}
              </div>
              <Button onClick={handleEdit} variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Muuda
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  {editData.photoURL ? (
                    <img 
                      src={editData.photoURL} 
                      alt="Profiil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-emerald-100"
                    />
                  ) : (
                   <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-3xl font-bold text-emerald-600">
                     {editData.displayName?.charAt(0) || fullName?.charAt(0) || 'U'}
                   </div>
                  )}
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-700">
                   <Camera className="w-4 h-4 text-white" />
                   <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  </div>
                  <div className="flex-1 space-y-3">
                  <div>
                   <label className="text-sm text-slate-600 mb-1 block">Kuvatav nimi</label>
                   <Input 
                     value={editData.displayName}
                     onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                     placeholder={fullName}
                   />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Sugu</label>
                    <Select 
                      value={editData.gender || 'none'}
                      onValueChange={(value) => setEditData({ ...editData, gender: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vali sugu" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Määramata</SelectItem>
                        <SelectItem value="M">Mees</SelectItem>
                        <SelectItem value="N">Naine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">Tutvustus</label>
                    <Textarea 
                      value={editData.bio}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      placeholder="Kirjelda ennast..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={uploading || updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Salvestan...' : <><Save className="w-4 h-4 mr-2" /> Salvesta</>}
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Tühista
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Stats Grid - simplified for now */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
           <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-emerald-600" /><span className="text-sm text-slate-500">Mängud</span></div>
             <div className="text-2xl font-bold text-slate-800">{totalGames}</div>
           </div>
           <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-emerald-600" /><span className="text-sm text-slate-500">Täpsus</span></div>
             <div className="text-2xl font-bold text-slate-800">{puttingPercentage}%</div>
           </div>
           <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-5 h-5 text-emerald-600" /><span className="text-sm text-slate-500">Keskmine skoor</span></div>
             <div className="text-2xl font-bold text-slate-800">{avgScore}</div>
           </div>
           <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-amber-500" /><span className="text-sm text-slate-500">Parim skoor</span></div>
             <div className="text-2xl font-bold text-slate-800">{bestScore}</div>
           </div>
        </div>
        
        {/* Game History */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-slate-800">Mängude ajalugu</h3>
             {/* Filter UI */}
           </div>

          {filteredGames.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Mänge ei leitud</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                     <tr className="border-b border-slate-200">
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Mäng</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Kuupäev</th>
                       <th className="text-left py-3 px-2 text-slate-600 font-semibold">Formaat</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">Skoor</th>
                       <th className="text-right py-3 px-2 text-slate-600 font-semibold">%</th>
                       <th className="text-center py-3 px-2 text-slate-600 font-semibold"></th>
                     </tr>
                   </thead>
                  <tbody>
                    {filteredGames.slice((currentPage - 1) * GAMES_PER_PAGE, currentPage * GAMES_PER_PAGE).map((game) => {
                      const putts = game.player_putts?.[user.uid] || [];
                      const made = putts.filter(p => p.result === 'made').length;
                      const percentage = putts.length > 0 ? ((made / putts.length) * 100).toFixed(0) : 0;
                      const score = game.total_points?.[user.uid] || 0;
                      const gameFormat = GAME_FORMATS[game.game_type || 'classic'];

                      return (
                        <tr key={game.id} className="border-b border-slate-100 hover:bg-slate-50">
                           <td className="py-3 px-2 font-medium text-slate-700">{game.name}</td>
                           <td className="py-3 px-2 text-slate-700">
                             {game.date ? format(toDate(game.date), 'MMM d, yyyy') : '-'}
                           </td>
                           <td className="py-3 px-2">
                             <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                               {gameFormat?.name || 'Tundmatu'}
                             </span>
                           </td>
                           <td className="py-3 px-2 text-right font-bold text-emerald-600">{score}</td>
                           <td className="py-3 px-2 text-right text-slate-700">{percentage}%</td>
                           <td className="py-3 px-2 text-center">
                               <Link
                                 to={`${createPageUrl('GameResult')}?id=${game.id}`}
                                 className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700"
                               >
                                 <ExternalLink className="w-4 h-4" />
                               </Link>
                           </td>
                         </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        
        {/* Achievements */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              Saavutused ({unlockedAchievements.length}/{achievements.length})
            </h3>
          </div>
          <AchievementsList achievements={achievements} />
        </div>
      </div>
    </div>
  );
}
