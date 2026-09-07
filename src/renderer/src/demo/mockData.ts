import { SerializedDocument, SerializedFieldValue, SerializedTimestamp } from '@shared/firestore-types';
import { ConnectionInfo, SavedQuery } from '@shared/ipc-types';

export const DEMO_CONNECTIONS: ConnectionInfo[] = [
  {
    id: 'demo-conn-ecommerce',
    name: 'E-Commerce Production',
    projectId: 'ecommerce-prod-824a',
    clientEmail: 'service-account@ecommerce-prod-824a.iam.gserviceaccount.com',
    createdAt: Date.now() - 86400000 * 14,
    authType: 'serviceAccount',
    readOnly: false,
  },
  {
    id: 'demo-conn-saas',
    name: 'SaaS Metrics & Billing (Read-Only)',
    projectId: 'saas-metrics-live',
    clientEmail: 'analyst@saas-metrics-live.iam.gserviceaccount.com',
    createdAt: Date.now() - 86400000 * 30,
    authType: 'oauth',
    readOnly: true,
  },
];

export const DEMO_COLLECTIONS: Record<string, { id: string; path: string }[]> = {
  'demo-conn-ecommerce': [
    { id: 'users', path: 'users' },
    { id: 'products', path: 'products' },
    { id: 'orders', path: 'orders' },
    { id: 'reviews', path: 'reviews' },
  ],
  'demo-conn-saas': [
    { id: 'tenants', path: 'tenants' },
    { id: 'subscriptions', path: 'subscriptions' },
    { id: 'events', path: 'events' },
  ],
};

function createDoc(
  id: string,
  collectionPath: string,
  fields: Record<string, SerializedFieldValue>,
  timestampSec = 1714000000
): SerializedDocument {
  const ts: SerializedTimestamp = {
    seconds: timestampSec,
    nanoseconds: 0,
    iso: new Date(timestampSec * 1000).toISOString(),
  };
  return {
    __id: id,
    __path: `${collectionPath}/${id}`,
    __createTime: ts,
    __updateTime: ts,
    fields,
  };
}

// Seeded documents covering all 10 Firestore field types
export const INITIAL_DOCUMENTS: Record<string, SerializedDocument[]> = {
  // ── 1. Users collection ──
  'users': [
    createDoc('usr_sarah_connor', 'users', {
      name: { __type: 'string', value: 'Sarah Connor' },
      email: { __type: 'string', value: 'sarah.connor@sky.net' },
      age: { __type: 'number', value: 34 },
      isActive: { __type: 'boolean', value: true },
      role: { __type: 'string', value: 'admin' },
      phoneNumber: { __type: 'null', value: null },
      location: {
        __type: 'geopoint',
        value: { latitude: 34.0522, longitude: -118.2437 },
      },
      primaryOrder: {
        __type: 'reference',
        value: { path: 'orders/ord_101', collectionId: 'orders', documentId: 'ord_101' },
      },
      address: {
        __type: 'map',
        value: {
          street: { __type: 'string', value: '123 Tech Blvd' },
          city: { __type: 'string', value: 'Los Angeles' },
          state: { __type: 'string', value: 'CA' },
          postalCode: { __type: 'number', value: 90001 },
        },
      },
      tags: {
        __type: 'array',
        value: [
          { __type: 'string', value: 'vip' },
          { __type: 'string', value: 'early-adopter' },
        ],
      },
      createdAt: {
        __type: 'timestamp',
        value: { seconds: 1714000000, nanoseconds: 0, iso: '2024-04-24T23:06:40.000Z' },
      },
    }, 1714000000),

    createDoc('usr_john_wick', 'users', {
      name: { __type: 'string', value: 'John Wick' },
      email: { __type: 'string', value: 'baba.yaga@continental.org' },
      age: { __type: 'number', value: 42 },
      isActive: { __type: 'boolean', value: true },
      role: { __type: 'string', value: 'member' },
      phoneNumber: { __type: 'string', value: '+1 (555) 019-2834' },
      location: {
        __type: 'geopoint',
        value: { latitude: 40.7128, longitude: -74.006 },
      },
      primaryOrder: {
        __type: 'reference',
        value: { path: 'orders/ord_102', collectionId: 'orders', documentId: 'ord_102' },
      },
      address: {
        __type: 'map',
        value: {
          street: { __type: 'string', value: 'Continental Hotel' },
          city: { __type: 'string', value: 'New York' },
          state: { __type: 'string', value: 'NY' },
          postalCode: { __type: 'number', value: 10005 },
        },
      },
      tags: {
        __type: 'array',
        value: [
          { __type: 'string', value: 'priority' },
          { __type: 'string', value: 'gold-coin' },
        ],
      },
      createdAt: {
        __type: 'timestamp',
        value: { seconds: 1715000000, nanoseconds: 0, iso: '2024-05-06T12:53:20.000Z' },
      },
    }, 1715000000),

    createDoc('usr_elena_rostova', 'users', {
      name: { __type: 'string', value: 'Elena Rostova' },
      email: { __type: 'string', value: 'elena@novatech.io' },
      age: { __type: 'number', value: 29 },
      isActive: { __type: 'boolean', value: false },
      role: { __type: 'string', value: 'guest' },
      phoneNumber: { __type: 'null', value: null },
      location: {
        __type: 'geopoint',
        value: { latitude: 51.5074, longitude: -0.1278 },
      },
      primaryOrder: {
        __type: 'null',
        value: null,
      },
      address: {
        __type: 'map',
        value: {
          street: { __type: 'string', value: '45 Baker Street' },
          city: { __type: 'string', value: 'London' },
          state: { __type: 'string', value: 'UK' },
        },
      },
      tags: {
        __type: 'array',
        value: [{ __type: 'string', value: 'newsletter' }],
      },
      createdAt: {
        __type: 'timestamp',
        value: { seconds: 1716000000, nanoseconds: 0, iso: '2024-05-18T02:40:00.000Z' },
      },
    }, 1716000000),

    createDoc('usr_marcus_vance', 'users', {
      name: { __type: 'string', value: 'Marcus Vance' },
      email: { __type: 'string', value: 'marcus@quantum.dev' },
      age: { __type: 'number', value: 37 },
      isActive: { __type: 'boolean', value: true },
      role: { __type: 'string', value: 'member' },
      phoneNumber: { __type: 'string', value: '+1 (555) 782-9912' },
      location: {
        __type: 'geopoint',
        value: { latitude: 37.7749, longitude: -122.4194 },
      },
      primaryOrder: {
        __type: 'reference',
        value: { path: 'orders/ord_103', collectionId: 'orders', documentId: 'ord_103' },
      },
      address: {
        __type: 'map',
        value: {
          street: { __type: 'string', value: '789 Market St' },
          city: { __type: 'string', value: 'San Francisco' },
          state: { __type: 'string', value: 'CA' },
          postalCode: { __type: 'number', value: 94103 },
        },
      },
      tags: {
        __type: 'array',
        value: [{ __type: 'string', value: 'engineer' }, { __type: 'string', value: 'beta-tester' }],
      },
      createdAt: {
        __type: 'timestamp',
        value: { seconds: 1717000000, nanoseconds: 0, iso: '2024-05-29T16:26:40.000Z' },
      },
    }, 1717000000),
  ],

  // ── 2. Products collection ──
  'products': [
    createDoc('prod_mechanical_keyboard', 'products', {
      title: { __type: 'string', value: 'Wireless Mechanical Keyboard (RGB)' },
      price: { __type: 'number', value: 149.99 },
      stock: { __type: 'number', value: 85 },
      inStock: { __type: 'boolean', value: true },
      category: { __type: 'string', value: 'peripherals' },
      thumbnailHash: { __type: 'bytes', value: 'a8b2c4e9f01132' },
      specs: {
        __type: 'map',
        value: {
          switches: { __type: 'string', value: 'Cherry MX Brown' },
          batteryLifeHours: { __type: 'number', value: 72 },
          bluetooth: { __type: 'boolean', value: true },
        },
      },
      tags: {
        __type: 'array',
        value: [{ __type: 'string', value: 'gaming' }, { __type: 'string', value: 'wireless' }, { __type: 'string', value: 'desk-setup' }],
      },
    }),

    createDoc('prod_noise_cancelling_headphones', 'products', {
      title: { __type: 'string', value: 'Studio Pro ANC Wireless Headphones' },
      price: { __type: 'number', value: 299.5 },
      stock: { __type: 'number', value: 24 },
      inStock: { __type: 'boolean', value: true },
      category: { __type: 'string', value: 'audio' },
      thumbnailHash: { __type: 'bytes', value: 'd3f9e8a104bc' },
      specs: {
        __type: 'map',
        value: {
          ancLevelDb: { __type: 'number', value: 35 },
          driverSizeMm: { __type: 'number', value: 40 },
        },
      },
      tags: {
        __type: 'array',
        value: [{ __type: 'string', value: 'audio' }, { __type: 'string', value: 'travel' }],
      },
    }),

    createDoc('prod_curved_ultrawide_monitor', 'products', {
      title: { __type: 'string', value: '34-Inch Curved Ultrawide 144Hz Monitor' },
      price: { __type: 'number', value: 599.0 },
      stock: { __type: 'number', value: 0 },
      inStock: { __type: 'boolean', value: false },
      category: { __type: 'string', value: 'monitors' },
      thumbnailHash: { __type: 'bytes', value: '11ffaa8899cc' },
      specs: {
        __type: 'map',
        value: {
          resolution: { __type: 'string', value: '3440 x 1440' },
          refreshRateHz: { __type: 'number', value: 144 },
          hdr: { __type: 'boolean', value: true },
        },
      },
      tags: {
        __type: 'array',
        value: [{ __type: 'string', value: 'workstation' }, { __type: 'string', value: 'gaming' }],
      },
    }),
  ],

  // ── 3. Orders collection ──
  'orders': [
    createDoc('ord_101', 'orders', {
      orderNumber: { __type: 'string', value: 'ORD-2024-101' },
      userRef: {
        __type: 'reference',
        value: { path: 'users/usr_sarah_connor', collectionId: 'users', documentId: 'usr_sarah_connor' },
      },
      totalAmount: { __type: 'number', value: 449.49 },
      status: { __type: 'string', value: 'delivered' },
      isPaid: { __type: 'boolean', value: true },
      discountCode: { __type: 'null', value: null },
      placedAt: {
        __type: 'timestamp',
        value: { seconds: 1714500000, nanoseconds: 0, iso: '2024-04-30T18:00:00.000Z' },
      },
      shippingCoordinates: {
        __type: 'geopoint',
        value: { latitude: 34.0522, longitude: -118.2437 },
      },
    }, 1714500000),

    createDoc('ord_102', 'orders', {
      orderNumber: { __type: 'string', value: 'ORD-2024-102' },
      userRef: {
        __type: 'reference',
        value: { path: 'users/usr_john_wick', collectionId: 'users', documentId: 'usr_john_wick' },
      },
      totalAmount: { __type: 'number', value: 149.99 },
      status: { __type: 'string', value: 'processing' },
      isPaid: { __type: 'boolean', value: true },
      discountCode: { __type: 'string', value: 'CONTINENTAL10' },
      placedAt: {
        __type: 'timestamp',
        value: { seconds: 1716500000, nanoseconds: 0, iso: '2024-05-23T21:46:40.000Z' },
      },
      shippingCoordinates: {
        __type: 'geopoint',
        value: { latitude: 40.7128, longitude: -74.006 },
      },
    }, 1716500000),

    createDoc('ord_103', 'orders', {
      orderNumber: { __type: 'string', value: 'ORD-2024-103' },
      userRef: {
        __type: 'reference',
        value: { path: 'users/usr_marcus_vance', collectionId: 'users', documentId: 'usr_marcus_vance' },
      },
      totalAmount: { __type: 'number', value: 599.0 },
      status: { __type: 'string', value: 'pending' },
      isPaid: { __type: 'boolean', value: false },
      discountCode: { __type: 'null', value: null },
      placedAt: {
        __type: 'timestamp',
        value: { seconds: 1717100000, nanoseconds: 0, iso: '2024-05-30T20:13:20.000Z' },
      },
      shippingCoordinates: {
        __type: 'geopoint',
        value: { latitude: 37.7749, longitude: -122.4194 },
      },
    }, 1717100000),
  ],

  // ── 4. Subcollection: orders/ord_101/items ──
  'orders/ord_101/items': [
    createDoc('item_1', 'orders/ord_101/items', {
      productRef: {
        __type: 'reference',
        value: { path: 'products/prod_mechanical_keyboard', collectionId: 'products', documentId: 'prod_mechanical_keyboard' },
      },
      name: { __type: 'string', value: 'Wireless Mechanical Keyboard (RGB)' },
      quantity: { __type: 'number', value: 1 },
      unitPrice: { __type: 'number', value: 149.99 },
    }),
    createDoc('item_2', 'orders/ord_101/items', {
      productRef: {
        __type: 'reference',
        value: { path: 'products/prod_noise_cancelling_headphones', collectionId: 'products', documentId: 'prod_noise_cancelling_headphones' },
      },
      name: { __type: 'string', value: 'Studio Pro ANC Wireless Headphones' },
      quantity: { __type: 'number', value: 1 },
      unitPrice: { __type: 'number', value: 299.5 },
    }),
  ],

  // ── 5. Subcollection: orders/ord_102/items ──
  'orders/ord_102/items': [
    createDoc('item_1', 'orders/ord_102/items', {
      productRef: {
        __type: 'reference',
        value: { path: 'products/prod_mechanical_keyboard', collectionId: 'products', documentId: 'prod_mechanical_keyboard' },
      },
      name: { __type: 'string', value: 'Wireless Mechanical Keyboard (RGB)' },
      quantity: { __type: 'number', value: 1 },
      unitPrice: { __type: 'number', value: 149.99 },
    }),
  ],

  // ── 6. Reviews collection ──
  'reviews': [
    createDoc('rev_001', 'reviews', {
      productRef: {
        __type: 'reference',
        value: { path: 'products/prod_mechanical_keyboard', collectionId: 'products', documentId: 'prod_mechanical_keyboard' },
      },
      rating: { __type: 'number', value: 5 },
      author: { __type: 'string', value: 'Sarah Connor' },
      comment: { __type: 'string', value: 'Extremely tactile and battery lasts for days!' },
      verifiedPurchase: { __type: 'boolean', value: true },
    }),
    createDoc('rev_002', 'reviews', {
      productRef: {
        __type: 'reference',
        value: { path: 'products/prod_noise_cancelling_headphones', collectionId: 'products', documentId: 'prod_noise_cancelling_headphones' },
      },
      rating: { __type: 'number', value: 4 },
      author: { __type: 'string', value: 'John Wick' },
      comment: { __type: 'string', value: 'Cancels out gunshot reverberations well.' },
      verifiedPurchase: { __type: 'boolean', value: true },
    }),
  ],

  // ── 7. SaaS Project: tenants, subscriptions, events ──
  'tenants': [
    createDoc('tenant_acme_corp', 'tenants', {
      companyName: { __type: 'string', value: 'Acme Corporation' },
      tier: { __type: 'string', value: 'enterprise' },
      seatCount: { __type: 'number', value: 250 },
      mrr: { __type: 'number', value: 4900 },
      isDelinquent: { __type: 'boolean', value: false },
      contractExpires: {
        __type: 'timestamp',
        value: { seconds: 1735689600, nanoseconds: 0, iso: '2025-01-01T00:00:00.000Z' },
      },
    }),
    createDoc('tenant_globex', 'tenants', {
      companyName: { __type: 'string', value: 'Globex Industries' },
      tier: { __type: 'string', value: 'scale' },
      seatCount: { __type: 'number', value: 75 },
      mrr: { __type: 'number', value: 1450 },
      isDelinquent: { __type: 'boolean', value: false },
      contractExpires: {
        __type: 'timestamp',
        value: { seconds: 1727740800, nanoseconds: 0, iso: '2024-10-01T00:00:00.000Z' },
      },
    }),
  ],

  'subscriptions': [
    createDoc('sub_enterprise_01', 'subscriptions', {
      tenantId: { __type: 'string', value: 'tenant_acme_corp' },
      plan: { __type: 'string', value: 'Enterprise Annual' },
      status: { __type: 'string', value: 'active' },
      billingCycle: { __type: 'string', value: 'annual' },
    }),
  ],

  'events': [
    createDoc('evt_login_success', 'events', {
      eventType: { __type: 'string', value: 'user.login' },
      sourceIp: { __type: 'string', value: '198.51.100.42' },
      success: { __type: 'boolean', value: true },
      timestamp: {
        __type: 'timestamp',
        value: { seconds: 1717200000, nanoseconds: 0, iso: '2024-06-01T00:00:00.000Z' },
      },
    }),
  ],
};

export const DEMO_SAVED_QUERIES: SavedQuery[] = [
  {
    id: 'query-active-users',
    name: 'Active Users Over 30',
    collectionPath: 'users',
    where: [
      { field: 'isActive', operator: '==', value: { __type: 'boolean', value: true } },
      { field: 'age', operator: '>=', value: { __type: 'number', value: 30 } },
    ],
    orderBy: [{ field: 'age', direction: 'desc' }],
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'query-in-stock-products',
    name: 'Products Under $300',
    collectionPath: 'products',
    where: [
      { field: 'price', operator: '<', value: { __type: 'number', value: 300 } },
    ],
    orderBy: [{ field: 'price', direction: 'asc' }],
    createdAt: Date.now() - 3600000 * 12,
  },
];
