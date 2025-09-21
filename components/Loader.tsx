
import React from 'react';

interface LoaderProps {
  message: string;
}

const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-800/50 rounded-lg">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-green-400"></div>
      <p className="mt-6 text-lg font-medium text-white">Generating Your Video</p>
      <p className="mt-2 text-slate-300">{message}</p>
    </div>
  );
};

export default Loader;