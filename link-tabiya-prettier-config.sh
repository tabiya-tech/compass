echo "LINKING TABIYA PRETTIER CONFIG FOR LINUX/MACOS"
# First unlink to ensure that any previous link is removed
(cd frontend-new && yarn unlink @tabiya/prettier-config) ;
(cd @tabiya/prettier-config && yarn unlink) ;
# Create a symbolic link to the config.
(cd @tabiya/prettier-config && yarn link) &&
# Finally, link the package to the 'frontend' project.
(cd frontend-new && yarn link @tabiya/prettier-config) ;

