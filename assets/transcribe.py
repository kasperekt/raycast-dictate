import sys
from parakeet_mlx import from_pretrained

model = from_pretrained("mlx-community/parakeet-tdt-0.6b-v3")
print("Starting!!! for {}".format(sys.argv[1]))
result = model.transcribe(sys.argv[1])
print(result.text)