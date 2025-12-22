import React, { useState } from 'react';
import { User } from '../types';
import { USERS } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = USERS.find(u => u.username === username && u.password === password);

    if (user) {
      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-8 text-center">
            <h1 className="text-3xl font-bold text-blue-400 mb-2">WareFlow</h1>
            <p className="text-slate-400 text-sm">Inventory Management System</p>
        </div>
        
        <div className="p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Sign In</h2>
            
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Enter username"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Enter password"
                    />
                </div>
                
                <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition"
                >
                    Login
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
                <p>Demo Credentials:</p>
                <div className="mt-2 flex justify-center gap-4">
                    <span>Admin: <strong>admin / admin</strong></span>
                    <span>User: <strong>operator / user</strong></span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;