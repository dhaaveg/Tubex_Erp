export type NavigationTab = 
  | 'overview'
  | 'master-data'
  | 'procurement'
  | 'receiving'
  | 'customer-orders'
  | 'shop-floor'
  | 'quality'
  | 'traceability'
  | 'admin-export'
  | 'user-management';

export const VALID_MODULES: Record<string, NavigationTab> = {
  'overview': 'overview',
  'master-data': 'master-data',
  'procurement': 'procurement',
  'receiving': 'receiving',
  'customer-orders': 'customer-orders',
  'shop-floor': 'shop-floor',
  'quality': 'quality',
  'traceability': 'traceability',
  'admin-export': 'admin-export',
  'user-management': 'user-management',
  // Short URL aliases & alternate paths
  'dashboard': 'overview',
  'home': 'overview',
  'master': 'master-data',
  'suppliers': 'master-data',
  'products': 'master-data',
  'po': 'procurement',
  'pos': 'procurement',
  'purchase-orders': 'procurement',
  'purchasing': 'procurement',
  'purchases': 'procurement',
  'tally': 'receiving',
  'grn': 'receiving',
  'inwarding': 'receiving',
  'inward': 'receiving',
  'cpo': 'customer-orders',
  'customers': 'customer-orders',
  'orders': 'customer-orders',
  'sales': 'customer-orders',
  'wo': 'shop-floor',
  'wos': 'shop-floor',
  'work-orders': 'shop-floor',
  'shopfloor': 'shop-floor',
  'production': 'shop-floor',
  'manufacturing': 'shop-floor',
  'rejections': 'quality',
  'qa': 'quality',
  'qc': 'quality',
  'inspection': 'quality',
  'trace': 'traceability',
  'export': 'admin-export',
  'reports': 'admin-export',
  'users': 'user-management',
  'admin': 'user-management',
  'roles': 'user-management',
};

export const TAB_ROUTES: Record<NavigationTab, string> = {
  'overview': '/',
  'master-data': '/master-data',
  'procurement': '/procurement',
  'receiving': '/receiving',
  'customer-orders': '/customer-orders',
  'shop-floor': '/shop-floor',
  'quality': '/quality',
  'traceability': '/traceability',
  'admin-export': '/admin-export',
  'user-management': '/user-management',
};
