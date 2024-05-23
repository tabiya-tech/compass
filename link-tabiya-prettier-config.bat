@ECHO ON
echo "LINKING TABIYA PRETTIER CONFIG FOR WINDOWS"

:: ********************************************************
:: First unlink to ensure that any previous links is removed
:: ********************************************************
popd
pushd frontend-new
call yarn unlink @tabiya/prettier-config
:: back to the root of the project
popd
pushd @tabiya/prettier-config
call yarn unlink
:: back to the root of the project
popd

:: ********************************************************
:: Creates a symbolic link to the config.
:: ********************************************************
pushd @tabiya/prettier-config
call yarn link
:: back to the root of the project
popd
pushd frontend-new
call yarn link @tabiya/prettier-config
:: back to the root of the project
popd
```