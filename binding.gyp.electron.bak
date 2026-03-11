{
  "targets": [
    {
      "target_name": "cursor-events",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        ["OS=='win'", {
      	  "sources": [ "src/native/cursor-events/cursor-events.cc" ]
      	}],
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    }
  ]
}
