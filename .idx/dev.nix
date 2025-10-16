{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20 # Using Node.js version 20
  ];

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];

    # Enable previews and define the web preview
    previews = {
      enable = true;
      previews = {
        web = {
          # Command to start the frontend dev server
          command = ["sh" "-c" "cd frontend && npm run dev -- --port $PORT"];
          manager = "web";
        };
        backend = {
          command = ["sh" "-c" "uvicorn backend.main:app --host 0.0.0.0 --port 8000"];
          manager = "web";
        };
      };
    };

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        # Install frontend dependencies
        npm-install = "cd frontend && npm install";
        # Install backend dependencies
        pip-install = "pip install -r backend/requirements.txt";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # start-backend is now handled by the backend preview
      };
    };
  };
}
