require('dotenv').config()
const express = require('express')
const graphqlHTTP = require('express-graphql')
const graphql = require('graphql')
const { Client } = require('pg')
const joinMonster = require('join-monster')
const {HOST, DATABASE} = process.env

// For connecting to local PostgreSQL Database
const client = new Client({
  host: HOST,
  user: '',
  password: '',
  database: DATABASE
})
client.connect()

// GraphQL Setup:
const Player = new graphql.GraphQLObjectType({
  name: 'Player',
  fields: () => ({
    id: { type: graphql.GraphQLString },
    first_name: { type: graphql.GraphQLString },
    last_name: { type: graphql.GraphQLString },
    team: {
      type: Team,
      sqlJoin: (playerTable, teamTable, args) =>
        `${playerTable}.team_id = ${teamTable}.id`
    }
  })
})

Player._typeConfig = {
  sqlTable: 'player',
  uniqueKey: 'id'
}

var Team = new graphql.GraphQLObjectType({
  name: 'Team',
  fields: () => ({
    id: { type: graphql.GraphQLInt },
    name: { type: graphql.GraphQLString },
    players: {
      type: graphql.GraphQLList(Player),
      sqlJoin: (teamTable, playerTable, args) =>
        `${teamTable}.id = ${playerTable}.team_id`
    }
  })
})

Team._typeConfig = {
  sqlTable: 'team',
  uniqueKey: 'id'
}

const MutationRoot = new graphql.GraphQLObjectType({
  name: 'Mutation',
  fields: () => ({
    player: {
      type: Player,
      args: {
        first_name: { type: graphql.GraphQLNonNull(graphql.GraphQLString) },
        last_name: { type: graphql.GraphQLNonNull(graphql.GraphQLString) },
        team_id: { type: graphql.GraphQLNonNull(graphql.GraphQLInt) }
      },
      resolve: async (parent, args, context, resolveInfo) => {
        try {
          return (await client.query(
            'INSERT INTO player (first_name, last_name, team_id) VALUES ($1, $2, $3) RETURNING *',
            [args.first_name, args.last_name, args.team_id]
          )).rows[0]
        } catch (err) {
          throw new Error('Failed ot insert new player')
        }
      }
    }
  })
})

const QueryRoot = new graphql.GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    hello: {
      type: graphql.GraphQLString,
      resolve: () => 'Hello world!'
    },
    players: {
      type: new graphql.GraphQLList(Player),
      resolve: (parent, args, context, resolveInfo) => {
        return joinMonster.default(resolveInfo, {}, sql => {
          return client.query(sql)
        })
      }
    },
    player: {
      type: Player,
      args: { id: { type: graphql.GraphQLNonNull(graphql.GraphQLInt) } },
      where: (playerTable, args, context) => `${playerTable}.id = ${args.id}`,
      resolve: (parent, args, context, resolveInfo) => {
        return joinMonster.default(resolveInfo, {}, sql => {
          return client.query(sql)
        })
      }
    },
    teams: {
      type: new graphql.GraphQLList(Team),
      resolve: (parent, args, context, resolveInfo) => {
        return joinMonster.default(resolveInfo, {}, sql => {
          return client.query(sql)
        })
      }
    }
  })
})
const schema = new graphql.GraphQLSchema({
  query: QueryRoot,
  mutation: MutationRoot
})

// Express App:
const app = express()

app.use(
  '/api',
  graphqlHTTP({
    schema: schema,
    graphiql: true
  })
)

app.listen(4000, () => console.log(`Listening on port 4000`))
