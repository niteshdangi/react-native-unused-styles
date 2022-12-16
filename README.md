# react-native-unused-styles
## Removes all unused styles inside any folder, also checks for all imports.

To get all unused styles in the space separted directories passed in args.
Will search for styles in current dir, for usage of styles declared in directories provided.

```bash
$ npx -y react-native-unused-styles ./dir ./dir2
```

### Options:
- --remove : To auto remove unused styles [Optional]. If not used will return all  unused styles file wise in json file.

- --remove-json ./path: To auto remove unused styles from the provided json file in args, the content should be similar to json returned by this library.



## TODO:
- Support for stylesheet & JSX in same file.
- Remove unused imports