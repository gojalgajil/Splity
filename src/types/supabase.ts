export type Tables = {
  people: {
    id: string
    name: string
    amount: number
    created_at: string
  }
  items: {
    id: string
    name: string
    price: number
    shared_by: string[] // Array of person IDs
    created_at: string
  }
}