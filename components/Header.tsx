import React from 'react';
import SparklesIcon from './icons/SparklesIcon';

const Header: React.FC = () => {
  return (
    <header className="w-full p-4 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto flex items-center">
        <div className="flex items-center flex-shrink-0">
          <SparklesIcon className="h-8 w-8 text-green-400 mr-3" />
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            VEO Video Generator
          </h1>
        </div>
      </div>
    </header>
  );
};

export default Header;