# Stage 1: Build the application
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Enable Corepack for Yarn 4 support
RUN corepack enable

# Copy yarn configuration and lock file
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install all dependencies (including devDependencies)
RUN yarn install --immutable

# Copy the application source code and configuration files
COPY nest-cli.json tsconfig.json ./
COPY rate-limiter ./rate-limiter

# Build the NestJS application
RUN yarn build

# Stage 2: Create the production image
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Set node environment to production
ENV NODE_ENV=production

# Enable Corepack for Yarn 4 support
RUN corepack enable

# Copy yarn configuration and lock file
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Install only production dependencies
RUN yarn workspaces focus --production

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Use the built-in non-root node user for better security
USER node

# Expose the application port
EXPOSE 3000
# Start the application after running migrations
# Runs compiled migration runner then starts the NestJS app
CMD ["sh", "-c", "yarn migration:run:prod && yarn start:prod"]
