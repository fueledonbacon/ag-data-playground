require('dotenv').config()
const { ApolloServer, gql } = require('apollo-server')
const store = require('./store')
const { GraphQLJSON, GraphQLJSONObject } = require('graphql-type-json')
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const typeDefs = gql`
  scalar Date
  scalar JSON
  scalar JSONObject

  type Query{
    soilMoistureBalance(fieldId: Int!, start: Date, end: Date): SoilMoistureBalanceData
  }

  type Grower{
    id: ID!
    name: String,
    farms: [Farm]
  }

  type Farm{
    id: ID!
    fields: [Field]
    name: String
  }

  type Field{
    id: ID!
    plantings: [Planting]
  }

  type Planting{
    id: ID!
    name: String
    type: String
    variety: String
    plantingDate: Date
  }

  type Measurement{
    id: ID!
    type: String
    date: Date
    value: Float
  }

  type SoilMoistureBalanceData{
    data: [TimeSeriesDatapoint]
  }

  type TimeSeriesDatapoint{
    date: Date
    value: Float
  }
`

const resolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value); // value from the client
    },
    serialize(value) {
      return value.getTime(); // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(+ast.value) // ast value is always in string format
      }
      return null;
    },
  }),
  JSON: GraphQLJSON,
  JSONObject: GraphQLJSONObject,
  Query: {
    soilMoistureBalance: () => ({
      data: [
        {
          date: new Date(),
          value: 2
        }
      ]
    })
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  playground: true,
  context: store
})

server.listen(process.env.PORT).then(() => {
  console.log(`Listening on ${process.env.PORT}`)
})