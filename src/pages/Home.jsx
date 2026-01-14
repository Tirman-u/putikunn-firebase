import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Settings, User, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';



export default function Home() {

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  return (
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-4">
        <div className="max-w-lg mx-auto pt-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              Welcome {user?.full_name || 'Guest'}!
            </h1>
            <p className="text-slate-600 text-xl mb-8">Ready to make some putts?</p>
          </div>

          <div className="space-y-4">
            <Link
              to={createPageUrl('PuttingKingHome')}
              className="w-full bg-white rounded-2xl p-6 shadow-sm border-2 border-slate-200 hover:border-purple-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Trophy className="w-7 h-7 text-purple-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-slate-800">Putting King</h3>
                  <p className="text-sm text-slate-500">Manage tournaments and competitions</p>
                </div>
              </div>
            </Link>

            <div className="pt-4 border-t-2 border-slate-200 mt-6 space-y-3">
            <Link
              to={createPageUrl('ManageGames')}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <Settings className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-base font-bold text-slate-800">Manage Games</h3>
                  <p className="text-xs text-slate-500">View and organize your games</p>
                </div>
              </div>
            </Link>

            <Link
              to={createPageUrl('Profile')}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <User className="w-6 h-6 text-slate-600" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-base font-bold text-slate-800">My Profile</h3>
                  <p className="text-xs text-slate-500">Stats and game history</p>
                </div>
              </div>
            </Link>
            </div>
          </div>
        </div>
      </div>
    );
}