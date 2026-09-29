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
  // Short URL aliases
  'po': 'procurement',
  'pos': 'procurement',
  'purchase-orders': 'procurement',
  'tally': 'receiving',
  'grn': 'receiving',
  'inwarding': 'receiving',
  'cpo': 'customer-orders',
  'customers': 'customer-orders',
  'orders': 'customer-orders',
  'wo': 'shop-floor',
  'wos': 'shop-floor',
  'work-orders': 'shop-floor',
  'shopfloor': 'shop-floor',
  'rejections': 'quality',
  'qa': 'quality',
  'export': 'admin-export',
  'users': 'user-management',
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
