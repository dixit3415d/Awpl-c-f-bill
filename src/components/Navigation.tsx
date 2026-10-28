import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Building2,
  UserCog,
  Boxes,
  CreditCard,
  ShieldAlert,
  Landmark,
  Menu,
  X,
  LogOut,
  Dumbbell
} from 'lucide-react';
import { AppPortalMode, Role } from '../types';

export type NavTab =
  | 'dashboard'
  | 'billing'
  | 'gitfit_hub'
  | 'invoices'
  | 'ledgers'
  | 'products'
  | 'cf_portal'
  | 'staff'
  | 'customer_store'
  | 'inventory'
  | 'subscriptions'
  | 'audit';

interface NavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUserRole: Role;
  activePortal?: AppPortalMode;
  unreadCount?: number;
  onLogout?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  currentUserRole,
  activePortal = 'cnf_app',
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Requirement #10: When in Customer App or Main App, hide C&F navigation bar so each app is strictly separate
  if (activePortal !== 'cnf_app') {
    return null;
  }

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'C&F Dashboard',
      icon: LayoutDashboard,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'support_staff'],
    },
    {
      id: 'gitfit_hub' as NavTab,
      label: 'GitFit App',
      icon: Dumbbell,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'support_staff', 'inventory_staff'],
      badge: 'Workout + POS',
    },
    {
      id: 'billing' as NavTab,
      label: 'POS Billing',
      icon: ShoppingCart,
      roles: ['super_admin', 'franchise_admin', 'billing_staff'],
      badge: 'Barcode + Search',
    },
    {
      id: 'invoices' as NavTab,
      label: 'Bills & Sessions',
      icon: Receipt,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'support_staff'],
      badge: '#3000+ / Edit',
    },
    {
      id: 'products' as NavTab,
      label: 'AWPL Catalog',
      icon: Package,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'inventory_staff'],
      badge: 'Fuzzy Search',
    },
    {
      id: 'inventory' as NavTab,
      label: 'Stock & Purchase',
      icon: Boxes,
      roles: ['super_admin', 'franchise_admin', 'inventory_staff', 'billing_staff'],
      badge: '∞ / Purchase',
    },
    {
      id: 'cf_portal' as NavTab,
      label: 'C&F Portal',
      icon: Building2,
      roles: ['super_admin', 'franchise_admin', 'support_staff', 'billing_staff'],
      badge: 'Online Sync',
    },
    {
      id: 'ledgers' as NavTab,
      label: 'Ledgers & Bank',
      icon: Landmark,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'support_staff'],
      badge: 'Cash/UPI/Bank',
    },
    {
      id: 'staff' as NavTab,
      label: 'Staff',
      icon: UserCog,
      roles: ['super_admin', 'franchise_admin', 'billing_staff', 'support_staff', 'inventory_staff'],
    },
    {
      id: 'subscriptions' as NavTab,
      label: 'C&F Subscription',
      icon: CreditCard,
      roles: ['super_admin', 'franchise_admin'],
    },
    {
      id: 'audit' as NavTab,
      label: 'Audit & Cloud',
      icon: ShieldAlert,
      roles: ['super_admin', 'franchise_admin'],
    },
  ];

  const allowedItems = navItems.filter(
    (item) => item.roles.includes(currentUserRole) || currentUserRole === 'super_admin'
  );

  return (
    <>
      {/* Desktop & Tablet Top Tab Bar (White & Orange Theme) */}
      <nav className="hidden lg:block bg-white dark:bg-slate-900 border-b border-orange-200 dark:border-slate-800 shadow-2xs print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6 overflow-x-auto py-2">
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-600'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-700'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                <span>{item.label}</span>
                {item.badge && !isActive && (
                  <span className="rounded-md bg-orange-100 dark:bg-orange-950/80 px-1.5 py-0.2 text-[9px] font-black text-orange-800 dark:text-orange-300 border border-orange-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="ml-auto flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 hover:border-red-600 px-3 py-2 text-xs font-black whitespace-nowrap transition cursor-pointer shrink-0"
              title="Log Out of C&F App Session"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Android Bottom Navigation Bar (White & Orange) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-orange-500 lg:hidden shadow-lg print:hidden">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {allowedItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1 transition ${
                  isActive
                    ? 'text-orange-600 dark:text-orange-400 font-black'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    isActive ? 'bg-orange-500 text-white shadow-xs' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[65px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 text-slate-600 dark:text-slate-400"
          >
            <div className="p-1 rounded-xl bg-orange-50 text-orange-600">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-bold">All Tabs</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm lg:hidden">
          <div className="rounded-t-3xl bg-white dark:bg-slate-900 p-6 space-y-4 max-h-[80vh] overflow-y-auto border-t-4 border-orange-500">
            <div className="flex items-center justify-between border-b pb-3 border-orange-200 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                C&amp;F Bill — All C&amp;F Modules
              </h3>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-orange-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {allowedItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition ${
                      isActive
                        ? 'bg-orange-500 text-white border-orange-600 shadow-sm'
                        : 'bg-orange-50/50 dark:bg-slate-800/50 border-orange-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-orange-100'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-orange-600'}`} />
                    <span className="font-bold truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {onLogout && (
              <div className="pt-2 border-t border-orange-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white py-3 text-xs font-black shadow transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out of User Account</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
