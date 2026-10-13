import React from 'react';
import { IconUser } from './Icons';

interface CastMember {
  name: string;
  photoUrl?: string;
  character?: string;
  role?: string;
}

interface CastCardProps {
  member: CastMember;
  role?: 'cast' | 'crew';
}

export default function CastCard({ member, role = 'cast' }: CastCardProps) {
  return (
    <div className="group rounded-2xl p-4 bg-[#11131c] border border-white/[0.06] hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 flex flex-col items-center text-center">
      {/* Profile Photo */}
      <div className="w-20 h-20 rounded-full overflow-hidden mb-3 bg-[#181a26] border-2 border-white/10 group-hover:border-orange-500/60 shadow-md group-hover:scale-105 transition-all">
        {member.photoUrl ? (
          <img
            src={member.photoUrl}
            alt={member.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 group-hover:text-orange-400">
            <IconUser size={30} />
          </div>
        )}
      </div>

      {/* Actor / Crew Name */}
      <h4 className="font-outfit font-bold text-sm text-neutral-200 group-hover:text-orange-400 transition-colors truncate w-full">
        {member.name}
      </h4>

      {/* Role / Character */}
      <p className="text-xs text-neutral-400 mt-1 truncate w-full font-medium">
        {role === 'cast' ? member.character || 'Cast' : member.role || 'Crew'}
      </p>
    </div>
  );
}
