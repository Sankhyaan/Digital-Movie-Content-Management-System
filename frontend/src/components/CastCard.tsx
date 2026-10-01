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
    <div
      className="glass-card flex flex-col items-center text-center p-4"
      style={{ minWidth: '140px', maxWidth: '160px' }}
    >
      {/* Photo */}
      <div
        className="w-20 h-20 rounded-full overflow-hidden mb-3"
        style={{
          border: '2px solid var(--border-subtle)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        }}
      >
        <img
          src={member.photoUrl}
          alt={member.name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/200x200/141428/6366f1?text=${encodeURIComponent(member.name.charAt(0))}`;
          }}
        />
      </div>

      {/* Name */}
      <h4
        className="text-sm font-semibold truncate w-full"
        style={{ color: 'var(--text-primary)' }}
      >
        {member.name}
      </h4>

      {/* Character / Role */}
      <p
        className="text-xs mt-1 truncate w-full"
        style={{ color: 'var(--text-muted)' }}
      >
        {role === 'cast' ? member.character : member.role}
      </p>
    </div>
  );
}
