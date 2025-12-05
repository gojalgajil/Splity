'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { Menu, X } from 'lucide-react';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const isActive = (path: string) => {
    return pathname === path || (path === '/upload' && pathname.includes('/select-user'));
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Upload', path: '/select-user' },
    { name: 'Settlement', path: '/settlement' },
  ];

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Home */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors"
          >
            <img
              src="/logo.png"
              alt="Splity Logo"
              className="w-14 h-14 object-contain"
            />
            <span className="font-bold text-lg">Splity</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.path) 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Theme Toggle and Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={`mobile-${link.path}`}
                  href={link.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive(link.path)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
