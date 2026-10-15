export const typeDefs = `#graphql
  type Category {
    id: ID!
    name: String!
    sortOrder: Int
    isActive: Boolean
    products: [Product!]!
  }

  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    imageUrl: String
    isAvailable: Boolean
    sortOrder: Int
    prepTimeMinutes: Int
    category: Category!
    modifierGroups: [ModifierGroup!]!
  }

  type ModifierGroup {
    id: ID!
    name: String!
    minSelections: Int
    maxSelections: Int
    isRequired: Boolean
    options: [ModifierOption!]!
  }

  type ModifierOption {
    id: ID!
    name: String!
    priceDelta: Float!
    isDefault: Boolean
  }

  type Query {
    categories: [Category!]!
    category(id: ID!): Category
    products(categoryId: ID, onlyAvailable: Boolean): [Product!]!
    product(id: ID!): Product
    modifierGroups: [ModifierGroup!]!
  }

  type Mutation {
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    setProductAvailability(id: ID!, isAvailable: Boolean!): Product!
    createModifierGroup(input: CreateModifierGroupInput!): ModifierGroup!
    updateModifierGroup(id: ID!, input: UpdateModifierGroupInput!): ModifierGroup!
    deleteModifierGroup(id: ID!): Boolean!
    addModifierOption(groupId: ID!, input: AddModifierOptionInput!): ModifierOption!
    removeModifierOption(id: ID!): Boolean!
    attachModifierGroup(productId: ID!, groupId: ID!): Product!
    detachModifierGroup(productId: ID!, groupId: ID!): Product!
  }

  input CreateCategoryInput {
    name: String!
    sortOrder: Int
  }

  input UpdateCategoryInput {
    name: String
    sortOrder: Int
    isActive: Boolean
  }

  input CreateProductInput {
    categoryId: ID!
    name: String!
    description: String
    price: Float!
    imageUrl: String
    sortOrder: Int
    prepTimeMinutes: Int
  }

  input UpdateProductInput {
    name: String
    description: String
    price: Float
    imageUrl: String
    categoryId: ID
    sortOrder: Int
    prepTimeMinutes: Int
  }

  input CreateModifierGroupInput {
    name: String!
    minSelections: Int
    maxSelections: Int
    isRequired: Boolean
  }

  input UpdateModifierGroupInput {
    name: String
    minSelections: Int
    maxSelections: Int
    isRequired: Boolean
  }

  input AddModifierOptionInput {
    name: String!
    priceDelta: Float
    isDefault: Boolean
  }
`;
