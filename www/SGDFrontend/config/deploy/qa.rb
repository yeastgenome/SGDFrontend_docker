set :stage, :dev

server ENV['QA_SERVER'], user: fetch(:user), port: 22, roles: %w{app}
